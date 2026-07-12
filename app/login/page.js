import LoginForm from "@/components/login-form";

export const metadata = {
  title: "Sign in | Brokie OS"
};

export default function LoginPage() {
  return (
    <main className="loginPage">
      <LoginForm />
    </main>
  );
}
