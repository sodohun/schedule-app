import ScheduleApp, { ScheduleItem } from "@/components/ScheduleApp";

async function fetchSchedule(): Promise<ScheduleItem[]> {
  try {
    const url =
      "https://open.neis.go.kr/hub/SchoolSchedule?KEY=cf3461906ef84a45b574ad79fdae0c49&ATPT_OFCDC_SC_CODE=C10&SD_SCHUL_CODE=7150597&Type=json&pIndex=1&pSize=400&AA_FROM_YMD=202610&AA_TO_YMD=202612";
    
    // Server-side fetch (Next.js fetches data on the server)
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      throw new Error(`Failed to fetch data: ${res.status}`);
    }
    const data = await res.json();
    
    if (data.SchoolSchedule && data.SchoolSchedule.length > 1) {
      return data.SchoolSchedule[1].row || [];
    }
    return [];
  } catch (error) {
    console.error("Error fetching school schedule:", error);
    return [];
  }
}

export default async function Home() {
  const scheduleData = await fetchSchedule();

  return (
    <main>
      <ScheduleApp initialData={scheduleData} />
    </main>
  );
}
