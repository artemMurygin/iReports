import { BarChart3, Bell } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function Navbar() {
  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 shrink-0">
      {/* Left: logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 bg-[#38d97b] rounded-lg">
          <BarChart3 className="w-[18px] h-[18px] text-white" />
        </div>
        <span className="text-lg font-semibold text-gray-900 " style={{ fontFamily: "Inter, sans-serif" }}>
          iRepair Сервис | Воронка продаж
        </span>
      </div>

      {/* Right: bell + avatar */}
      {/*<div className="flex items-center gap-4">*/}
      {/*  <button className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors">*/}
      {/*    <Bell className="w-5 h-5 text-gray-500" />*/}
      {/*  </button>*/}
      {/*  <Avatar className="w-8 h-8">*/}
      {/*    <AvatarFallback className="bg-indigo-600 text-white text-xs font-semibold">*/}
      {/*      JD*/}
      {/*    </AvatarFallback>*/}
      {/*  </Avatar>*/}
      {/*</div>*/}
    </header>
  )
}