import "./globals.css";

export const metadata = {
  title: "Brokie OS",
  description: "The operating system for The Brokie brand."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
