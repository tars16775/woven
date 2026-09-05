import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
