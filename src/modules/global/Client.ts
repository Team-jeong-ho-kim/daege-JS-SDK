// import axios from "axios";
// import { type EventMap, Events } from "./Events.js";
// import { ClientError } from "../../Errors/Client.js";

// interface ClientOptions {
//   baseUrl: string;
//   Id?: string;
//   password?: string;
// }

// type Listener<T extends unknown[]> = (...args: T) => void;

// export class Client {
//   private readonly baseUrl: string;

//   private readonly Id?: string;

//   private readonly password?: string;

//   private readonly listeners = new Map<Events, Set<(...args: any[]) => void>>();

//   private token?: string | null;

//   constructor(options: ClientOptions) {
//     this.baseUrl = options.baseUrl;
//     if (options.Id) {
//       this.Id = options.Id;
//     }
//     if (options.password) {
//       this.password = options.password;
//     }
//     if (!this.Id && this.password) {
//       throw new ClientError("ID is required for password login");
//     }
//     this.initialize();

//     async () => {
//       this.token = await this.getToken();
//     };
//   }

//   protected initialize(): void {}

//   public async login() {
//     await this.connectServer();
//   }

//   on<K extends Events>(event: K, callback: Listener<EventMap[K]>): this {
//     let listeners = this.listeners.get(event);

//     if (!listeners) {
//       listeners = new Set();
//       this.listeners.set(event, listeners);
//     }

//     listeners.add(callback);

//     return this;
//   }

//   protected emit<K extends Events>(event: K, ...args: EventMap[K]): void {
//     const listeners = this.listeners.get(event);

//     if (!listeners) return;

//     for (const listener of listeners) {
//       listener(...args);
//     }
//   }

//   private async getToken() {
//     const res = await axios.post(`${this.baseUrl}/auth/signin`, {
//       id: this.Id,
//       password: this.password,
//     });
//     // TODO: 실 위치로 변경 필요
//     return res.headers.token;
//   }

//   private async *connectServer(): AsyncGenerator<StreamEvent> {
//     const controller = new AbortController();

//     for await (const event of this.streamPosts()) {
//     }

//     cosnt;
//     yield;
//   }
// }

// export type ReadyClient = Client;
import axios from "axios";
import { type EventMap, Events, type StreamEvent } from "./Events.js";
import { ClientError } from "../../Errors/Client.js";

/**
 * Client 생성 시 전달받는 옵션.
 *
 * - baseUrl: API 서버 주소
 * - Id/password: 로그인에 사용할 인증 정보
 */
interface ClientOptions {
  baseUrl: string;
  Id?: string;
  password?: string;
}

/**
 * EventMap에 정의된 이벤트 인자 튜플을
 * 실제 콜백 함수 타입으로 변환한다.
 *
 * 예:
 * EventMap[Events.Ready] = [client: Client]
 *
 * ↓
 *
 * Listener<EventMap[Events.Ready]>
 * = (client: Client) => void
 */
type Listener<T extends unknown[]> = (...args: T) => void;

export class Client {
  /**
   * API 서버의 기본 URL.
   *
   * Client 생성 이후 바뀔 이유가 없으므로 readonly.
   */
  private readonly baseUrl: string;

  /**
   * 로그인 ID.
   *
   * 인증 방식에 따라 없을 수도 있으므로 optional.
   */
  private readonly Id: string | undefined;

  /**
   * 로그인 비밀번호.
   *
   * ID와 마찬가지로 인증 방식에 따라 없을 수 있음.
   */
  private readonly password: string | undefined;

  /**
   * SDK 내부 이벤트 리스너 저장소.
   *
   * 구조:
   *
   * Events.PostCreated
   *   └─ Set
   *       ├─ listener A
   *       ├─ listener B
   *       └─ listener C
   *
   * Set을 사용하는 이유:
   * 같은 함수가 중복 등록되는 것을 자연스럽게 방지할 수 있음.
   *
   * 여기서는 Map 내부 저장 타입만 범용적으로 any[]를 사용하고,
   * 실제 public on()/emit()에서는 EventMap을 통해 타입을 검증한다.
   */
  private readonly listeners = new Map<Events, Set<(...args: any[]) => void>>();

  /**
   * 서버에서 발급받은 인증 토큰.
   *
   * login() 전에는 undefined일 수 있고,
   * 인증 정책에 따라 null도 가능하다고 가정한 상태.
   */
  private token?: string;

  /**
   * 현재 SSE 연결을 종료하기 위한 AbortController.
   *
   * disconnect()가 호출되면 이 controller를 abort하여
   * streamPosts() 내부의 HTTP 연결을 중단한다.
   */
  private abortController: AbortController | undefined;

  constructor(options: ClientOptions) {
    // Client가 사용할 기본 설정을 저장한다.
    this.baseUrl = options.baseUrl;
    this.Id = options.Id;
    this.password = options.password;

    /**
     * 비밀번호 로그인을 시도하면서 ID가 없는 경우는
     * 정상적인 인증 요청을 만들 수 없으므로 즉시 오류 처리.
     */
    if (!this.Id && this.password) {
      throw new ClientError("ID is required for password login");
    }

    /**
     * 하위 클래스가 추가 초기화를 수행할 수 있도록 제공하는 hook.
     *
     * 기본 Client에서는 아무 작업도 하지 않는다.
     */
    this.initialize();
  }

  /**
   * Client 초기화 hook.
   *
   * 하위 클래스가 Client를 상속할 경우 override해서
   * 자신에게 필요한 초기화 작업을 추가할 수 있다.
   */
  protected initialize(): void {}

  /**
   * 서버에 로그인하고 실시간 이벤트 스트림 연결을 시작한다.
   *
   * 흐름:
   *
   * 1. ID / password로 토큰 발급
   * 2. AbortController 생성
   * 3. SSE 스트림 연결 시작
   * 4. Ready 이벤트 발생
   *
   * 주의:
   * SSE는 장시간 유지되는 연결이므로 connectServer()를 await하지 않는다.
   *
   * 만약 아래처럼 작성하면:
   *
   *   await this.connectServer(...)
   *
   * SSE 연결이 종료될 때까지 login()도 끝나지 않게 된다.
   */
  public async login(): Promise<void> {
    // 먼저 서버에 인증하여 토큰을 발급받는다.
    this.token = await this.getToken();

    // 이번 연결을 제어할 AbortController를 새로 만든다.
    this.abortController = new AbortController();

    /**
     * 서버 스트림 연결을 시작한다.
     *
     * await하지 않기 때문에 login()은 SSE 종료를 기다리지 않는다.
     * connectServer()는 이후 비동기적으로 계속 실행된다.
     */
    this.connectServer(this.abortController.signal).catch((error) => {
      /**
       * 사용자가 직접 disconnect()해서 발생한 종료라면
       * 정상적인 종료이므로 오류로 처리하지 않는다.
       */
      if (this.abortController?.signal.aborted) {
        return;
      }

      /**
       * 그 외의 경우는 실제 네트워크 오류,
       * 서버 오류, SSE 파싱 오류 등이므로 따로 처리해야 한다.
       *
       * 나중에는 console.error 대신
       * Events.Error 같은 이벤트로 전달하는 편이 좋다.
       */
      console.error(error);
    });

    /**
     * 인증이 완료되고 스트림 연결 시작까지 요청했으므로
     * SDK 사용자에게 Ready 상태를 알린다.
     *
     * EventMap에서 Ready 이벤트가 [Client]로 정의되어 있다면
     * this를 전달할 수 있다.
     */
    this.emit(Events.Ready, this);
  }

  /**
   * 현재 서버와의 스트림 연결을 종료한다.
   */
  public disconnect(): void {
    /**
     * AbortSignal을 사용하는 모든 작업에
     * "중단하라"는 신호를 보낸다.
     *
     * streamPosts() 내부 fetch 등에 이 signal이 전달되어 있다면
     * 실제 HTTP/SSE 연결도 여기서 종료된다.
     */
    this.abortController?.abort();

    // 이미 종료된 controller는 더 이상 필요하지 않으므로 제거.
    this.abortController = undefined;
  }

  /**
   * 특정 이벤트의 listener를 등록한다.
   *
   * EventMap을 사용하기 때문에 이벤트에 따라
   * callback 인자 타입이 자동으로 결정된다.
   *
   * 예:
   *
   * client.on(Events.PostCreated, (post) => {
   *   // post 타입 자동 추론
   * });
   */
  public on<K extends Events>(event: K, callback: Listener<EventMap[K]>): this {
    // 해당 이벤트에 등록된 listener Set을 가져온다.
    let listeners = this.listeners.get(event);

    /**
     * 아직 한 번도 등록된 적 없는 이벤트라면
     * 새로운 Set을 만들어 Map에 저장한다.
     */
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(event, listeners);
    }

    // callback을 이벤트 listener 목록에 추가한다.
    listeners.add(callback);

    /**
     * this를 반환하여 chaining 가능.
     *
     * client
     *   .on(...)
     *   .on(...)
     */
    return this;
  }

  /**
   * SDK 내부에서 이벤트를 발생시킨다.
   *
   * protected이므로 SDK 사용자가 직접 호출할 수 없고,
   * Client 또는 하위 클래스에서만 이벤트를 발생시킬 수 있다.
   *
   * EventMap[K]를 사용하므로 event별 인자 타입도 검사된다.
   */
  protected emit<K extends Events>(event: K, ...args: EventMap[K]): void {
    // 해당 이벤트에 등록된 listener를 조회한다.
    const listeners = this.listeners.get(event);

    // listener가 하나도 없다면 할 일이 없다.
    if (!listeners) return;

    /**
     * 같은 이벤트에 여러 listener가 등록될 수 있으므로
     * 모든 listener를 순서대로 호출한다.
     */
    for (const listener of listeners) {
      listener(...args);
    }
  }

  /**
   * ID/password를 이용해 서버에서 인증 토큰을 받아온다.
   */
  private async getToken(): Promise<string> {
    const res = await axios.post(`${this.baseUrl}/auth/signin`, {
      id: this.Id,
      password: this.password,
    });

    /**
     * TODO:
     * 실제 API의 토큰 위치에 맞춰 수정해야 함.
     *
     * 예:
     * res.data.token
     * res.headers.authorization
     * res.headers["x-access-token"]
     */
    return res.headers.token;
  }

  /**
   * 서버의 실시간 이벤트 스트림을 소비하는 역할.
   *
   * 이 함수 자체는 이벤트를 생성하지 않는다.
   *
   * streamPosts()
   *      ↓
   * StreamEvent
   *      ↓
   * connectServer()
   *      ↓
   * handleStreamEvent()
   *      ↓
   * emit(...)
   *
   * 즉 connectServer()는
   * "서버 스트림과 SDK 이벤트 시스템 사이를 연결하는 역할"이다.
   */
  private async connectServer(signal: AbortSignal): Promise<void> {
    /**
     * streamPosts()는 AsyncGenerator이므로
     * 이벤트가 도착할 때마다 하나씩 값을 yield한다.
     *
     * for await ... of는 새로운 이벤트가 올 때까지
     * 비동기적으로 기다린다.
     *
     * 이 대기 때문에 Node.js 전체가 block되지는 않는다.
     */
    for await (const event of this.streamPosts({ signal })) {
      // 서버 이벤트를 SDK 이벤트로 변환한다.
      this.handleStreamEvent(event);
    }

    /**
     * 여기까지 도달했다면 스트림이 정상적으로 끝났거나
     * AbortController 등에 의해 종료된 상태다.
     */
  }

  /**
   * 서버에서 받은 raw stream event를
   * Client의 Events 시스템으로 변환한다.
   *
   * 서버:
   *
   *   {
   *     type: "post.created",
   *     data: {...}
   *   }
   *
   * ↓
   *
   * SDK:
   *
   *   client.on(Events.PostCreated, ...)
   */
  private handleStreamEvent(event: StreamEvent): void {
    /**
     * 실제 StreamEvent 구조가 확정되면
     * 여기에서 event.type별로 분기한다.
     */
    /*
    switch (event.type) {
      case "post.created":
        this.emit(Events.PostCreated, event.data);
        break;

      case "post.deleted":
        this.emit(Events.PostDeleted, event.data);
        break;
    }
    */
  }

  /**
   * 실제 SSE / streaming HTTP 연결을 담당하는 함수.
   *
   * 이 함수만 AsyncGenerator이다.
   *
   * 역할:
   *
   * 1. 서버에 HTTP 연결
   * 2. response body에서 chunk 수신
   * 3. SSE 형식 파싱
   * 4. StreamEvent로 변환
   * 5. yield
   *
   * connectServer()는 여기서 yield된 값을 하나씩 소비한다.
   */
  private async *streamPosts(options: {
    signal: AbortSignal;
  }): AsyncGenerator<StreamEvent> {
    /**
     * 대략 최종 구현은 이런 구조가 된다.
     *
     * const response = await fetch(`${this.baseUrl}/posts/stream`, {
     *   headers: {
     *     Authorization: `Bearer ${this.token}`,
     *   },
     *   signal: options.signal,
     * });
     *
     * if (!response.body) {
     *   throw new ClientError("Stream body is empty");
     * }
     *
     * for await (const chunk of response.body) {
     *   const events = parseSSE(chunk);
     *
     *   for (const event of events) {
     *     yield event;
     *   }
     * }
     */

    // 아직 구현 전이므로 TypeScript 임시 처리.
    void options;
  }
}

/**
 * 현재는 Client와 완전히 동일한 alias.
 *
 * 향후:
 *
 * Client
 *   = 로그인 전/후 모두 가능한 Client
 *
 * ReadyClient
 *   = 로그인 및 연결 완료가 보장된 Client
 *
 * 같은 식으로 타입을 실제로 분리할 계획이 없다면
 * 현재 단계에서는 없어도 된다.
 */
export type ReadyClient = Client;
