"use client";

import { useRouter } from "next/navigation";
import { authUrlWithRedirect, readRedirectFromLocation } from "@/lib/redirect";
import { register } from "@/redux/features/authSlice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import BrandPanel, { BrandLogo } from "@/components/ui/BrandPanel";
import IconInput from "@/components/ui/IconInput";
import { ui } from "@/components/ui/styles";

const registerSchema = z
  .object({
    name: z.string().min(3, "Tên tối thiểu 3 ký tự"),
    email: z.string().email("Email không hợp lệ"),
    password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.auth);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    const result = await dispatch(
      register({ name: data.name, email: data.email, password: data.password }),
    );

    if (register.fulfilled.match(result)) {
      toast.success("Tạo tài khoản thành công! Mời bạn đăng nhập.");
      // Giữ trang cần quay lại cho bước đăng nhập
      router.push(authUrlWithRedirect("/login", readRedirectFromLocation()));
    }

    if (register.rejected.match(result)) {
      toast.error(result.payload || "Đăng ký thất bại");
    }
  };

  return (
    <div className={`flex w-full overflow-hidden ${ui.card}`}>
      <BrandPanel
        title="Tham gia Chat Zone"
        subtitle="Tạo tài khoản miễn phí để nhắn tin, gọi voice và chơi game cùng bạn bè."
      />

      <div className="flex flex-1 flex-col justify-center px-5 py-8 sm:px-10 sm:py-10">
        <div className="mb-6 flex items-center gap-3 md:hidden">
          <BrandLogo size={44} />
          <span className={`text-2xl font-extrabold ${ui.goldText}`}>
            Chat Zone
          </span>
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f4b942]/80">
          Đăng ký
        </p>
        <h2 className="mb-6 mt-1 text-2xl font-extrabold sm:text-3xl">
          Tạo tài khoản mới ✨
        </h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          <IconInput
            label="Tên hiển thị"
            icon={UserRound}
            autoComplete="name"
            placeholder="VD: Nguyễn Văn An"
            error={errors.name?.message}
            {...registerField("name")}
          />
          <IconInput
            label="Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="ban@email.com"
            error={errors.email?.message}
            {...registerField("email")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <IconInput
              label="Mật khẩu"
              icon={Lock}
              type="password"
              autoComplete="new-password"
              placeholder="Tối thiểu 6 ký tự"
              error={errors.password?.message}
              {...registerField("password")}
            />
            <IconInput
              label="Nhập lại mật khẩu"
              icon={ShieldCheck}
              type="password"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              error={errors.confirmPassword?.message}
              {...registerField("confirmPassword")}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`${ui.btnPrimary} mt-2 w-full`}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UserPlus className="h-5 w-5" />
            )}
            {loading ? "Đang tạo tài khoản…" : "Đăng ký"}
          </button>

          <p className="pt-2 text-center text-sm text-slate-400">
            Đã có tài khoản?{" "}
            <button
              type="button"
              onClick={() =>
                router.push(
                  authUrlWithRedirect("/login", readRedirectFromLocation()),
                )
              }
              className="font-bold text-[#ffd166] hover:underline"
            >
              Đăng nhập
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
