import WeightTracker from "@/components/weight-tracker"

export default function Home() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-balance font-sans text-3xl font-bold tracking-tight md:text-4xl">
            Weight Management Tracker
          </h1>
          <p className="text-pretty text-muted-foreground">
            Set your goals and track your progress with personalized weekly forecasts
          </p>
        </div>
        <WeightTracker />
      </div>
    </main>
  )
}
