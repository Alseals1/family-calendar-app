import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestPasswordReset } from "@/lib/auth/actions";
import { AUTH_COPY } from "@/lib/copy";
import { ForgotPasswordForm } from "./forgot-password-form";

vi.mock("@/lib/auth/actions", () => ({
  requestPasswordReset: vi.fn(async () => ({ status: "idle" })),
  resetPassword: vi.fn(),
  register: vi.fn(),
  logIn: vi.fn(),
  logOut: vi.fn(),
}));

beforeEach(() => vi.mocked(requestPasswordReset).mockClear());

function submit() {
  fireEvent.submit(
    screen.getByRole("button", { name: AUTH_COPY.forgotPasswordSubmit }).closest("form")!,
  );
}

describe("ForgotPasswordForm", () => {
  it("labels the email field", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(AUTH_COPY.emailLabel)).toBeInTheDocument();
  });

  it("shows an error for an empty email and does not call the action", () => {
    render(<ForgotPasswordForm />);
    submit();
    expect(screen.getByText(AUTH_COPY.emailInvalid)).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("shows an error for a malformed email and does not call the action", () => {
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(AUTH_COPY.emailLabel), { target: { value: "nope" } });
    submit();
    expect(screen.getByText(AUTH_COPY.emailInvalid)).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("calls the action once for a valid email", async () => {
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(AUTH_COPY.emailLabel), {
      target: { value: "pat@example.test" },
    });
    submit();
    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledTimes(1));
  });

  it("shows the neutral status with the address once sent", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValueOnce({
      status: "sent",
      email: "pat@example.test",
    });
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(AUTH_COPY.emailLabel), {
      target: { value: "pat@example.test" },
    });
    submit();
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(AUTH_COPY.checkEmailTitle);
    expect(status).toHaveTextContent(AUTH_COPY.resetEmailSentBody);
    expect(status).toHaveTextContent("pat@example.test");
  });

  it("shows a form error returned by the action", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValueOnce({
      status: "error",
      formError: AUTH_COPY.resetRequestFailed,
      email: "pat@example.test",
    });
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(AUTH_COPY.emailLabel), {
      target: { value: "pat@example.test" },
    });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(AUTH_COPY.resetRequestFailed);
  });
});
