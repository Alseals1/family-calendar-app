import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "@/lib/auth/actions";
import { AUTH_COPY } from "@/lib/copy";
import { RegisterForm } from "./register-form";

vi.mock("@/lib/auth/actions", () => ({
  register: vi.fn(async () => ({ status: "idle" })),
  logIn: vi.fn(),
  logOut: vi.fn(),
}));

beforeEach(() => vi.mocked(register).mockClear());

function submit() {
  fireEvent.submit(screen.getByRole("button", { name: AUTH_COPY.registerSubmit }).closest("form")!);
}

describe("RegisterForm", () => {
  it("labels every field", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(AUTH_COPY.fullNameLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(AUTH_COPY.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(AUTH_COPY.passwordLabel)).toBeInTheDocument();
  });

  it("shows field errors for empty input and does not call the action", () => {
    render(<RegisterForm />);
    submit();
    expect(screen.getByText(AUTH_COPY.nameRequired)).toBeInTheDocument();
    expect(screen.getByText(AUTH_COPY.emailInvalid)).toBeInTheDocument();
    expect(screen.getByText(AUTH_COPY.passwordTooShort)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("marks an invalid field and points it at its error", () => {
    render(<RegisterForm />);
    submit();
    const email = screen.getByLabelText(AUTH_COPY.emailLabel);
    expect(email).toHaveAttribute("aria-invalid", "true");
    const errorId = email.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveTextContent(AUTH_COPY.emailInvalid);
  });

  it("calls the action when the input is valid", async () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(AUTH_COPY.fullNameLabel), { target: { value: "Pat Example" } });
    fireEvent.change(screen.getByLabelText(AUTH_COPY.emailLabel), { target: { value: "pat@example.test" } });
    fireEvent.change(screen.getByLabelText(AUTH_COPY.passwordLabel), { target: { value: "correct-horse" } });
    submit();
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
  });
});
