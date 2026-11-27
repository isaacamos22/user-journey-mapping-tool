import { notFound } from "next/navigation";
import { loadJourneyShell } from "@/lib/journey/loadJourney";

export default async function ExportSummaryPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const journey = await loadJourneyShell(id);
  if (!journey) notFound();

  return (
    <div className="p-8 bg-white text-black min-h-screen">
      <header className="border-b-2 border-[#0014DC] pb-4 mb-6">
        <h1 className="text-2xl font-bold text-[#0014DC]">{journey.title}</h1>
        <p className="text-sm text-gray-600">Stakeholder summary · {new Date().toLocaleDateString()}</p>
      </header>
      <section>
        <h2 className="font-semibold mb-2">Personas</h2>
        <ul className="list-disc ml-5 text-sm">
          {journey.personas.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      </section>
      <section className="mt-6">
        <h2 className="font-semibold mb-2">Journey</h2>
        {journey.phases.map((ph) => (
          <div key={ph.id} className="mb-4">
            <h3 className="text-[#0014DC] font-medium">{ph.title}</h3>
            <ol className="list-decimal ml-5 text-sm">
              {ph.steps.map((s) => (
                <li key={s.id}>{s.userAction || s.title}</li>
              ))}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}