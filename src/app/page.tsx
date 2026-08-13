import Hero from "@/components/app/hero"
import Story from "@/components/app/story"
import Journey from "@/components/app/journey"
import Companies from "@/components/app/companies"
import Connect from "@/components/app/connect"
export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/95 overflow-hidden">
      <Hero />
      <Story />
      <Journey />
      <Companies />
      <Connect />
    </main>
  )
}

