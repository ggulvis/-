/* 보담 — 공용 컴포넌트
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 공용 컴포넌트 ---------------- */
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className={"bg-white w-full sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] overflow-y-auto " + (wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 flex items-center justify-between z-10">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-2">×</button>
        </div>
        <div className="px-4 sm:px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";
const btnPrimary = "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg px-4 py-2 text-sm disabled:opacity-50";
const btnGhost = "border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg px-4 py-2 text-sm";
const btnDanger = "bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 font-medium rounded-lg px-4 py-2 text-sm";

function RoleBadge({ role }) {
  const map = {
    admin: ["관리자", "bg-purple-100 text-purple-700"],
    manager: ["관리인", "bg-indigo-100 text-indigo-700"],
    editor: ["편집자", "bg-blue-100 text-blue-700"],
    viewer: ["보담회원", "bg-slate-200 text-slate-600"],
    pending: ["승인대기", "bg-amber-100 text-amber-700"],
  };
  const [label, cls] = map[role] || [role, "bg-slate-200 text-slate-600"];
  return <span className={"inline-block text-xs font-semibold px-2 py-0.5 rounded-full " + cls}>{label}</span>;
}
