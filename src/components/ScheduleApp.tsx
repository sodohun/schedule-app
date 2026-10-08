"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";

export type ScheduleItem = {
  AA_YMD: string; // "20261020"
  EVENT_NM: string;
  SBTR_DD_SC_NM: string; // "휴업일" 등
};

interface ScheduleAppProps {
  initialData: ScheduleItem[];
}

export default function ScheduleApp({ initialData }: ScheduleAppProps) {
  const [showHolidays, setShowHolidays] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleItem | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false); // 클라이언트 사이드 렌더링 확인용
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    
    // Auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          // Fetch favorites from Supabase
          const { data, error } = await supabase
            .from('favorites')
            .select('item_id')
            .eq('user_id', session.user.id);
            
          if (!error && data) {
            setFavorites(data.map(d => d.item_id));
          }
        } else {
          setFavorites([]); // Clear favorites on logout
          setSelectedEvent(null); // Clear selected event on logout
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 즐겨찾기가 불러와졌을 때, 선택된 일정이 없다면 가장 가까운 즐겨찾기 일정을 자동으로 선택
  useEffect(() => {
    if (favorites.length > 0 && !selectedEvent) {
      const todayTimestamp = new Date().setHours(0, 0, 0, 0);
      const firstFav = initialData.find((item) => {
        if (!favorites.includes(`${item.AA_YMD}-${item.EVENT_NM}`)) return false;
        const y = parseInt(item.AA_YMD.slice(0, 4), 10);
        const m = parseInt(item.AA_YMD.slice(4, 6), 10) - 1;
        const d = parseInt(item.AA_YMD.slice(6, 8), 10);
        return new Date(y, m, d).getTime() >= todayTimestamp;
      });
      
      if (firstFav) {
        setSelectedEvent(firstFav);
      }
    }
  }, [favorites, initialData, selectedEvent]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // 날짜 변환 헬퍼 (YYYYMMDD -> Date)
  const parseDate = (ymd: string) => {
    const y = parseInt(ymd.slice(0, 4), 10);
    const m = parseInt(ymd.slice(4, 6), 10) - 1;
    const d = parseInt(ymd.slice(6, 8), 10);
    return new Date(y, m, d);
  };

  const formatDateLabel = (ymd: string) => {
    const d = parseDate(ymd);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  // 오늘 날짜 0시 0분 기준 타임스탬프
  const todayTimestamp = new Date().setHours(0, 0, 0, 0);

  // 필터링 로직: 과거 일정 제외 및 '휴업일' 토글
  const filteredData = initialData.filter((item) => {
    const itemTime = parseDate(item.AA_YMD).getTime();
    if (itemTime < todayTimestamp) return false; // 오늘 이전 일정 제외

    if (showHolidays) return true;
    return item.SBTR_DD_SC_NM !== "휴업일";
  });

  const favoriteItems = filteredData.filter((item) =>
    favorites.includes(`${item.AA_YMD}-${item.EVENT_NM}`)
  );
  const normalItems = filteredData.filter(
    (item) => !favorites.includes(`${item.AA_YMD}-${item.EVENT_NM}`)
  );

  const toggleFavorite = async (e: React.MouseEvent, item: ScheduleItem) => {
    e.stopPropagation();
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }
    const id = `${item.AA_YMD}-${item.EVENT_NM}`;
    
    if (favorites.includes(id)) {
      setFavorites((prev) => prev.filter((f) => f !== id));
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('item_id', id);
    } else {
      setFavorites((prev) => [...prev, id]);
      await supabase.from('favorites').insert([{ user_id: user.id, item_id: id }]);
    }
  };

  // 카운트다운 타이머 로직
  useEffect(() => {
    if (!selectedEvent) {
      setTimeLeft(null);
      return;
    }

    const targetDate = parseDate(selectedEvent.AA_YMD);

    const updateTimer = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);

      setTimeLeft({ d, h, m, s });
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [selectedEvent]);

  const getTimerColorClass = () => {
    if (!timeLeft) return "text-white";
    if (timeLeft.d === 0) return "text-red-400";
    if (timeLeft.d < 7) return "text-orange-400";
    return "text-indigo-400";
  };

  const renderCard = (item: ScheduleItem, idx: number) => {
    const isSelected =
      selectedEvent?.EVENT_NM === item.EVENT_NM &&
      selectedEvent?.AA_YMD === item.AA_YMD;
    const isFavorite = favorites.includes(`${item.AA_YMD}-${item.EVENT_NM}`);

    return (
      <div
        key={`${item.AA_YMD}-${item.EVENT_NM}-${idx}`}
        onClick={() => setSelectedEvent(item)}
        className={`glass-panel p-6 rounded-2xl text-left transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl cursor-pointer group flex flex-col relative
          ${
            isSelected
              ? "ring-2 ring-primary bg-primary/10 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              : "hover:border-primary/50"
          }
        `}
      >
        <button
          onClick={(e) => toggleFavorite(e, item)}
          className={`absolute top-4 right-4 text-2xl transition-transform hover:scale-110 focus:outline-none drop-shadow-md z-10 
            ${isFavorite ? "opacity-100" : "opacity-30 hover:opacity-100 group-hover:opacity-100"}`}
          title="중요 일정 즐겨찾기"
        >
          {isFavorite ? "⭐" : "☆"}
        </button>
        <div className="flex justify-between items-start mb-4 pr-8 relative z-0">
          <span className="text-sm font-bold tracking-wider text-accent bg-accent/10 px-3 py-1 rounded-full">
            {formatDateLabel(item.AA_YMD)}
          </span>
          {item.SBTR_DD_SC_NM !== "해당없음" && (
            <span className="text-xs opacity-60 bg-white/10 px-2 py-1 rounded-md">
              {item.SBTR_DD_SC_NM}
            </span>
          )}
        </div>
        <h4 className="text-xl font-bold group-hover:text-primary transition-colors pr-8 relative z-0">
          {item.EVENT_NM}
        </h4>
      </div>
    );
  };

  // 하이드레이션 불일치 방지
  if (!mounted) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col items-center animate-fade-in">
      {/* Auth Header */}
      <div className="w-full max-w-5xl flex justify-end mb-4">
        {user ? (
          <div className="flex items-center gap-4 glass-panel px-4 py-2 rounded-full">
            <span className="text-sm font-medium">{user.user_metadata?.user_name || 'User'}님 환영합니다!</span>
            <button onClick={handleLogout} className="text-xs bg-white/10 hover:bg-white/20 transition-colors px-3 py-1 rounded-full">
              로그아웃
            </button>
          </div>
        ) : (
          <button onClick={handleLogin} className="flex items-center gap-2 glass-panel px-4 py-2 rounded-full hover:bg-white/10 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            <span className="text-sm font-medium">GitHub으로 로그인</span>
          </button>
        )}
      </div>

      <header className="mb-12 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
          학사일정 카운트다운
        </h1>
        <p className="text-lg opacity-80 max-w-xl mx-auto">
          2026년 하반기 학사일정을 확인하고 중요한 일정을 선택해 남은 시간을 확인하세요.
        </p>
      </header>

      {/* 카운트다운 디스플레이 영역 */}
      <div
        className={`glass-panel w-full max-w-3xl rounded-3xl p-8 mb-12 text-center transition-all duration-500 min-h-[220px] flex flex-col justify-center items-center
          ${selectedEvent ? "animate-pulse-slow border-primary/50" : "border-white/10"}`}
      >
        {selectedEvent && timeLeft ? (
          <div className="animate-slide-up">
            <h2 className="text-2xl font-semibold mb-6 opacity-90">
              {selectedEvent.EVENT_NM} ({formatDateLabel(selectedEvent.AA_YMD)})
            </h2>
            <div className="flex gap-4 sm:gap-8 justify-center items-baseline">
              <div className="flex flex-col">
                <span className={`text-6xl sm:text-8xl font-bold font-mono tracking-tighter ${getTimerColorClass()}`}>
                  {timeLeft.d}
                </span>
                <span className="text-sm uppercase tracking-widest opacity-60 mt-2">Days</span>
              </div>
              <span className="text-4xl opacity-40 font-mono">:</span>
              <div className="flex flex-col">
                <span className={`text-6xl sm:text-8xl font-bold font-mono tracking-tighter ${getTimerColorClass()}`}>
                  {timeLeft.h.toString().padStart(2, "0")}
                </span>
                <span className="text-sm uppercase tracking-widest opacity-60 mt-2">Hours</span>
              </div>
              <span className="text-4xl opacity-40 font-mono">:</span>
              <div className="flex flex-col">
                <span className={`text-6xl sm:text-8xl font-bold font-mono tracking-tighter ${getTimerColorClass()}`}>
                  {timeLeft.m.toString().padStart(2, "0")}
                </span>
                <span className="text-sm uppercase tracking-widest opacity-60 mt-2">Mins</span>
              </div>
              <span className="text-4xl opacity-40 font-mono">:</span>
              <div className="flex flex-col">
                <span className={`text-6xl sm:text-8xl font-bold font-mono tracking-tighter ${getTimerColorClass()}`}>
                  {timeLeft.s.toString().padStart(2, "0")}
                </span>
                <span className="text-sm uppercase tracking-widest opacity-60 mt-2">Secs</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xl opacity-50 flex flex-col items-center gap-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            아래 목록에서 일정을 선택하여 카운트다운을 시작하세요.
          </div>
        )}
      </div>

      {/* 필터 영역 */}
      <div className="w-full max-w-5xl mb-6">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-2xl font-bold">다가오는 일정</h3>
          <label className="flex items-center gap-3 cursor-pointer group">
            <span className="text-sm font-medium opacity-80 group-hover:opacity-100 transition-opacity">
              휴업일(토요일 등) 포함
            </span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={showHolidays}
                onChange={() => setShowHolidays(!showHolidays)}
              />
              <div className={`block w-12 h-7 rounded-full transition-colors ${showHolidays ? "bg-primary" : "bg-white/20"}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${showHolidays ? "transform translate-x-5" : ""}`}></div>
            </div>
          </label>
        </div>
      </div>

      {/* 즐겨찾기 리스트 */}
      {favoriteItems.length > 0 && (
        <div className="w-full max-w-5xl mb-12 animate-fade-in">
          <h4 className="text-lg font-semibold text-secondary mb-4 flex items-center gap-2 px-2">
            ⭐ 중요 일정 (즐겨찾기)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favoriteItems.map((item, idx) => renderCard(item, idx))}
          </div>
        </div>
      )}

      {/* 일반 일정 리스트 */}
      <div className="w-full max-w-5xl">
        {favoriteItems.length > 0 && normalItems.length > 0 && (
          <h4 className="text-lg font-semibold opacity-80 mb-4 px-2">일반 일정</h4>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {normalItems.map((item, idx) => renderCard(item, idx))}
        </div>
        
        {filteredData.length === 0 && (
          <div className="text-center py-12 opacity-50 glass-panel rounded-2xl">
            표시할 일정이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
