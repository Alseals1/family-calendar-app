import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthFormState } from "@/lib/auth/form-state";
import { AUTH_COPY } from "@/lib/copy";
import { PasswordForm } from "./password-form";

const action = vi.fn(async (): Promise<AuthFormState> => ({ status: "idle" }));

beforeEach(() => action.mockClear());

function renderForm() {
  return render(
    <PasswordForm
      action={action}
      submitLabel={AUTH_COPY.resetPasswordSubmit}
      pendingLabel={AUTH_COPY.resetPasswordPending}
    />,
  );
}

function submit() {
  fireEvent.submit(
    screen.getByRole("button", { name: AUTH_COPY.resetPasswordSubmit }).closest("form")!,
  );
}

function type(value: string) {
  fireEvent.change(screen.getByLabelText(AUTH_COPY.newPasswordLabel), { target: { value } });
}

describe("PasswordForm", () => {
  it("renders the password field and the given submit label", () => {
    renderForm();
    expect(screen.getByLabelText(AUTH_COPY.newPasswordLabel)).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: AUTH_COPY.resetPasswordSubmit })).toBeInTheDocument();
  });

  it("shows the too-short error for 7 characters and does not call the action", () => {
    renderForm();
    type("a".repeat(7));
    submit();
    expect(screen.getByText(AUTH_COPY.passwordTooShort)).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("calls the passed action once for 8 characters", async () => {
    renderForm();
    type("a".repeat(8));
    submit();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("shows a field error returned by the action", async () => {
    action.mockResolvedValueOnce({
      status: "error",
      fieldErrors: { password: AUTH_COPY.samePassword },
    });
    renderForm();
    type("a".repeat(8));
    submit();
    expect(await screen.findByText(AUTH_COPY.samePassword)).toBeInTheDocument();
  });

  it("shows a form error returned by the action", async () => {
    action.mockResolvedValueOnce({ status: "error", formError: AUTH_COPY.resetFailed });
    renderForm();
    type("a".repeat(8));
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(AUTH_COPY.resetFailed);
  });
});
