"use client";

import { useState, type ComponentPropsWithRef } from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { ui } from "./styles";

type Props = ComponentPropsWithRef<"input"> & {
  label: string;
  icon: LucideIcon;
  error?: string;
  hint?: string;
};

/**
 * Ô nhập có nhãn + icon + thông báo lỗi. Ô mật khẩu tự có nút ẩn / hiện.
 * Hỗ trợ react-hook-form: <IconInput {...register("email")} /> (React 19 nhận ref như prop).
 */
export default function IconInput({
  label,
  icon: Icon,
  error,
  hint,
  type = "text",
  disabled,
  ...inputProps
}: Props) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const id = inputProps.id ?? inputProps.name;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400"
      >
        {label}
      </label>
      <div
        className={`${ui.field} ${error ? "border-[#c81d25]/70" : ""} ${disabled ? "opacity-60" : ""}`}
      >
        <Icon className="h-4 w-4 shrink-0 text-[#f4b942]/80" />
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          disabled={disabled}
          aria-invalid={!!error}
          className="w-full min-w-0 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:text-[#ffd166]"
          >
            {show ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-[#ff8a7a]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
