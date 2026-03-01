import { BottomNav } from "@/components/bottom-nav";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background pb-20">
            <main className="max-w-lg mx-auto px-4 pt-4">{children}</main>
            <BottomNav />
        </div>
    );
}
