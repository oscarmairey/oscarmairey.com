"use client"

import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { useInView } from "react-intersection-observer"

const thoughts = [
  {
    title: "AI: Ideas matter more than execution",
    excerpt:
      "When anyone can build, the bottleneck shifts to thinking. AI has lowered the barrier to execution — the competitive advantage now belongs to those with better ideas.",
    image: "/conf2.png",
    date: "March 2025",
    url: "#thoughts",
  },
  {
    title: "Blockchain has no Product Market Fit (yet)",
    excerpt:
      "Billions invested, no killer app. What would it actually take for blockchain to find real product-market fit?",
    image: "/dubai.png",
    date: "March 2025",
    url: "#thoughts",
  },
  {
    title: "Why user-centric design matters",
    excerpt:
      "Empathy-driven design isn't a nice-to-have — it's what separates products that retain users from those that don't.",
    image: "/side.png",
    date: "February 2025",
    url: "#thoughts",
  },
]

export default function Thoughts() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  }

  return (
    <section id="thoughts" className="py-24 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10 bg-muted/30 dark:bg-muted/10">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-background to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-background to-transparent"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-heading mb-4">Thoughts & Writing</h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {thoughts.map((thought, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Link href={thought.url} className="block h-full cursor-pointer">
                <Card className="group overflow-hidden border border-border/50 bg-card hover:shadow-md transition-shadow duration-300 h-full flex flex-col relative">
                  <div className="relative h-56 overflow-hidden">
                    <Image
                      src={thought.image}
                      alt={thought.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <CardContent className="flex-1 p-6 flex flex-col">
                    <div className="mb-2 flex justify-between items-center">
                      <span className="text-sm text-foreground/60">{thought.date}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors duration-300">
                      {thought.title}
                    </h3>
                    <p className="text-foreground/70 mb-4 flex-1">{thought.excerpt}</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

