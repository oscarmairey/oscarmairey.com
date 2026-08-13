"use client";

/** A submit button that asks first. The action itself stays on the server; this
 *  only intercepts the click, so the form still works if the script fails. */
export default function ConfirmButton({
  message,
  className,
  formAction,
  children,
}: {
  message: string;
  className?: string;
  formAction: (form: FormData) => void | Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <button
      className={className}
      type="submit"
      formAction={formAction}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
