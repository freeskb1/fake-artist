"use client";

type Props = {
  role: "qm" | "fake" | "artist";
  category: string;
  subject: string;
  fakeName?: string;
};

export default function RoleCard({ role, category, subject, fakeName }: Props) {
  if (role === "qm") {
    return (
      <div className="bg-white rounded-3xl p-8 text-center">
        <p className="text-xs text-gray-500 mb-2">당신은</p>
        <p className="text-3xl font-black tracking-tight mb-4">출제자</p>
        <div className="bg-blue-50 rounded-2xl p-4 mb-2">
          <p className="text-xs text-blue-600 mb-1">범주: {category}</p>
          <p className="text-3xl font-black text-blue-700 tracking-tight">{subject}</p>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed mt-4">
          가짜 예술가: <b className="text-ink">{fakeName}</b>
          <br />
          당신은 그림에 참여하지 않아요
        </p>
      </div>
    );
  }
  if (role === "fake") {
    return (
      <div className="bg-white rounded-3xl p-8 text-center">
        <p className="text-xs text-gray-500 mb-2">당신은</p>
        <div className="bg-pink-50 text-pink-700 rounded-2xl p-4 mb-3">
          <p className="text-3xl font-black tracking-tight">가짜 예술가</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4">
          <p className="text-xs text-amber-700 mb-1">범주만 알아요</p>
          <p className="text-2xl font-black text-amber-800">{category}</p>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed mt-4">
          주제는 모르는 상태에서 분위기에 맞춰 그리세요
          <br />
          지목당하지 않거나, 주제를 맞히면 승리!
        </p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-3xl p-8 text-center">
      <p className="text-xs text-gray-500 mb-2">당신은</p>
      <p className="text-3xl font-black tracking-tight mb-4">예술가</p>
      <div className="bg-blue-50 rounded-2xl p-4">
        <p className="text-xs text-blue-600 mb-1">범주: {category}</p>
        <p className="text-3xl font-black text-blue-700 tracking-tight">{subject}</p>
      </div>
      <p className="text-sm text-gray-500 leading-relaxed mt-4">
        주제에 맞게 그리되, 가짜에게 너무 명확한 힌트는 금물!
      </p>
    </div>
  );
}
