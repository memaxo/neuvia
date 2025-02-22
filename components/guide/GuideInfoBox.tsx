import type { ReactNode } from "react";

export function GuideInfoBox(props: { children: ReactNode }) {
  return (
    <div className="text-md mx-auto my-16 flex w-full max-w-screen-md flex-col gap-5 overflow-hidden">
      <div className="text-center text-4xl">
        ▲ <span className="font-semibold">+</span> 🦜🔗
      </div>

      <div className="mx-auto max-w-[600px] text-center text-sm">
        {props.children}
      </div>
    </div>
  );
}
