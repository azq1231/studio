import TsmcRiskClient from "@/components/tsmc-risk/risk-client";

export async function generateStaticParams() {
    return [
        { month: "2025-10" },
        { month: "2025-11" },
        { month: "2025-12" },
        { month: "2026-01" },
    ];
}

export default function TsmcMonthlyRiskPage({ params }: { params: { month: string } }) {
    return <TsmcRiskClient month={params.month} />;
}
