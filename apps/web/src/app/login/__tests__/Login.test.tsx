import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../Login";

// 모킹
const loginMock = jest.fn();
const signupMock = jest.fn();

jest.mock("@/lib/auth", () => ({
  useAuth: () => ({
    login: loginMock,
    signup: signupMock,
  }),
}));

jest.mock("@/lib/locale", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        login_title: "LedgerFlow",
        login_subtitle: "로그인하세요",
        login_tab: "로그인",
        signup_tab: "회원가입",
        login_name: "이름",
        login_email: "이메일",
        login_password: "비밀번호",
        login_passwordConfirm: "비밀번호 확인",
        login_btn: "로그인",
        signup_btn: "가입하기",
        login_passwordMismatch: "비밀번호가 일치하지 않습니다",
        settings_passwordMin: "비밀번호는 최소 6자 이상이어야 합니다",
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/login",
}));

beforeEach(() => {
  loginMock.mockReset();
  signupMock.mockReset();
});

// submit 버튼 (type="submit")을 찾는 헬퍼
function getSubmitButton() {
  const buttons = screen.getAllByRole("button");
  return buttons.find((btn) => btn.getAttribute("type") === "submit")!;
}

describe("LoginPage", () => {
  it("기본적으로 로그인 폼을 렌더링한다", () => {
    render(<LoginPage />);

    expect(screen.getAllByText("LedgerFlow").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("email@example.com")).toBeInTheDocument();
    const submitBtn = getSubmitButton();
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toHaveTextContent("로그인");
  });

  it("회원가입 탭으로 전환한다", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // 탭 버튼 클릭
    await user.click(screen.getByText("회원가입"));

    // 회원가입 모드에서는 이름 필드가 표시된다
    expect(screen.getByPlaceholderText("홍길동")).toBeInTheDocument();
    // 제출 버튼이 "가입하기"로 변경
    const submitBtn = getSubmitButton();
    expect(submitBtn).toHaveTextContent("가입하기");
  });

  it("회원가입 시 비밀번호 불일치를 검증한다", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByText("회원가입"));

    await user.type(screen.getByPlaceholderText("홍길동"), "테스트");
    await user.type(
      screen.getByPlaceholderText("email@example.com"),
      "test@test.com",
    );

    const pwFields = screen.getAllByDisplayValue("").filter(
      (el) => (el as HTMLInputElement).type === "password",
    );
    await user.type(pwFields[0], "password123");
    await user.type(pwFields[1], "different456");

    await user.click(getSubmitButton());

    expect(
      screen.getByText("비밀번호가 일치하지 않습니다"),
    ).toBeInTheDocument();
    expect(signupMock).not.toHaveBeenCalled();
  });

  it("회원가입 시 비밀번호 최소 길이를 검증한다", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByText("회원가입"));

    await user.type(screen.getByPlaceholderText("홍길동"), "테스트");
    await user.type(
      screen.getByPlaceholderText("email@example.com"),
      "test@test.com",
    );

    const pwFields = screen.getAllByDisplayValue("").filter(
      (el) => (el as HTMLInputElement).type === "password",
    );
    await user.type(pwFields[0], "12345");
    await user.type(pwFields[1], "12345");

    await user.click(getSubmitButton());

    expect(
      screen.getByText("비밀번호는 최소 6자 이상이어야 합니다"),
    ).toBeInTheDocument();
    expect(signupMock).not.toHaveBeenCalled();
  });

  it("로그인 실패 시 에러 메시지를 표시한다", async () => {
    loginMock.mockRejectedValueOnce(new Error("로그인에 실패했습니다"));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("email@example.com"),
      "bad@test.com",
    );

    const pwField = screen.getAllByDisplayValue("").find(
      (el) => (el as HTMLInputElement).type === "password",
    )!;
    await user.type(pwField, "wrongpassword");

    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText("로그인에 실패했습니다")).toBeInTheDocument();
    });
  });

  it("제출 중 로딩 상태를 표시한다", async () => {
    loginMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000)),
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText("email@example.com"),
      "test@test.com",
    );

    const pwField = screen.getAllByDisplayValue("").find(
      (el) => (el as HTMLInputElement).type === "password",
    )!;
    await user.type(pwField, "password123");

    await user.click(getSubmitButton());

    // 로딩 중에는 "..." 표시되고 disabled 상태
    const submitBtn = getSubmitButton();
    expect(submitBtn).toHaveTextContent("...");
    expect(submitBtn).toBeDisabled();
  });
});
