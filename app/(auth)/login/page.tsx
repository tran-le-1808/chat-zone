"use client";

import { getProfile, login } from "@/redux/features/authSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, LogIn, Mail } from "lucide-react";
import BrandPanel, { BrandLogo } from "@/components/ui/BrandPanel";
import IconInput from "@/components/ui/IconInput";
import { ui } from "@/components/ui/styles";
import { authUrlWithRedirect, readRedirectFromLocation } from "@/lib/redirect";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.auth);

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

    if (login.fulfilled.match(result)) {
      toast.success("Đăng nhập thành công!");
      dispatch(getProfile());
      // Quay lại trang người dùng đang mở trước khi bị đưa sang login
      router.replace(readRedirectFromLocation());
    }

    if (login.rejected.match(result)) {
      toast.error(result.payload || "Đăng nhập thất bại");
    }
  };

  return (
    <div className={`flex w-full overflow-hidden ${ui.card}`}>
      <BrandPanel
        title="Chào mừng bạn quay lại!"
        subtitle="Đăng nhập để tiếp tục trò chuyện và thách đấu bạn bè."
      />

      <div className="flex flex-1 flex-col justify-center px-5 py-8 sm:px-10 sm:py-12">
        {/* Logo trên điện thoại (cột thương hiệu bị ẩn) */}
        <div className="mb-6 flex items-center gap-3 md:hidden">
          <BrandLogo size={44} />
          <span className={`text-2xl font-extrabold ${ui.goldText}`}>
            Chat Zone
          </span>
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f4b942]/80">
          Đăng nhập
        </p>
        <h2 className="mb-7 mt-1 text-2xl font-extrabold sm:text-3xl">
          Vào cuộc thôi nào 🎲
        </h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          <IconInput
            label="Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="ban@email.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <IconInput
            label="Mật khẩu"
            icon={Lock}
            type="password"
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            error={errors.password?.message}
            {...register("password")}
          />

          <button
            type="submit"
            disabled={loading}
            className={`${ui.btnPrimary} mt-2 w-full`}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <LogIn className="h-5 w-5" />
            )}
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>

          <p className="pt-2 text-center text-sm text-slate-400">
            Chưa có tài khoản?{" "}
            <button
              type="button"
              onClick={() =>
                router.push(
                  authUrlWithRedirect("/register", readRedirectFromLocation()),
                )
              }
              className="font-bold text-[#ffd166] hover:underline"
            >
              Đăng ký ngay
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
