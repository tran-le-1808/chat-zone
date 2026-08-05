"use client";

import { getProfile, login } from "@/redux/features/authSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    const result = await dispatch(
      login({ email: data.email, password: data.password }),
    );
    console.log("🚀 ~ onSubmit ~ result:", result);

    if (login.fulfilled.match(result)) {
      toast.success("Login successfully");
      dispatch(getProfile());
      router.push("/");
    }

    if (login.rejected.match(result)) {
      toast.error(result.payload || "Login failed");
    }
  };

  return (
    <div className="flex w-full overflow-hidden rounded-[20px] border border-white/10 shadow-2xl">
      {/* LEFT SIDE */}
      <div className="hidden w-[45%] flex-col items-center justify-center gap-6 border-r border-white/10 bg-gradient-to-b from-violet-600/30 to-cyan-500/20 p-12 text-center backdrop-blur-xl md:flex">
        <div className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/20 bg-white/10">
          <span className="text-3xl">💬</span>
        </div>

        <div>
          <h1 className="mb-2 text-2xl font-medium text-white">Digital Chat</h1>
          <p className="text-sm leading-relaxed text-white/50">
            Connect with friends and start chatting instantly
          </p>
        </div>

        <div className="w-full border-t border-white/10 pt-6 text-center">
          <span className="mb-2 block text-2xl">☕</span>
          <p className="text-sm text-white/60">Welcome Back!</p>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex flex-1 flex-col justify-center bg-white/[0.04] px-10 py-12 backdrop-blur-2xl">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[2px] text-white/35">
          Welcome back
        </p>
        <h2 className="mb-8 text-2xl font-medium text-white">Sign in here</h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          {/* EMAIL */}
          <div>
            <label className="mb-1.5 block text-xs text-white/50">Email</label>
            <div className="flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.07] px-3.5 py-2.5">
              <span className="text-white/35">✉</span>
              <input
                type="email"
                placeholder="Enter Email ID"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* PASSWORD */}
          <div>
            <label className="mb-1.5 block text-xs text-white/50">
              Password
            </label>
            <div className="flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.07] px-3.5 py-2.5">
              <span className="text-white/35">🔒</span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter Password"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-indigo-300 hover:text-indigo-200"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-[10px] bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Continue"}
          </button>

          <p className="pt-2 text-center text-sm text-white/40">
            Don&apos;t have an account?{" "}
            <span
              onClick={() => router.push("/register")}
              className="cursor-pointer text-indigo-300 hover:text-indigo-200"
            >
              Register
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
