"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "../actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form className="adm-login" action={action}>
      <h1>Editor</h1>

      <label className="adm-field">
        <span>Password</span>
        <input
          className="adm-input"
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </label>

      <button className="adm-btn primary" type="submit" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>

      {state.error && (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
