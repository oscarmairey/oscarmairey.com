"use client"

import { motion } from "framer-motion"
import { useInView } from "react-intersection-observer"
import Image from "next/image"

const journeyPoints = [
  {
    title: "Down the Rabbit Hole",
    period: "2020 - 2022",
    description:
      "I discovered crypto for the money, but stayed for the people. Behind the speculation was a vibrant community that accepted everyone as they were.",
    image: "/eiffeil.png",
  },
  {
    title: "Building & Shipping",
    period: "2022 - 2024",
    description:
      "Social intuition was my only asset. I used it to co-found Le Crypto Daily, now the largest francophone crypto media. I also launched a SocialFi app that raised $1.5M and debuted at CES Las Vegas.",
    image: "/ces.jpeg",
  },
  {
    title: "Going Global",
    period: "2024 - 2025",
    description:
      "I joined an AI company building blockchain-backed datasets as a core team member, relocating to Dubai to take on the role.",
    image: "/maya.png",
  },
  {
    title: "What\u2019s Next",
    period: "2025 - Present",
    description:
      "After an operational role at Chainraizer — applying blockchain to traditional finance through private equity tokenization — I joined ARTE One as an algorithmic asset manager powered by AI.",
    image: "/chainraizer.png",
  },
]

export default function Journey() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section id="journey" className="py-24 relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-heading">Chapters of Life</h2>
        </motion.div>

        <div className="max-w-4xl mx-auto relative">
          {/* Timeline line */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />

          <div className="space-y-12">
            {journeyPoints.map((point, index) => {
              const isEven = index % 2 === 0

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 50 }}
                  animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="relative grid md:grid-cols-2 gap-8 pl-10 md:pl-0"
                >
                  {/* Text Content */}
                  <div className={isEven ? "order-1" : "order-2"}>
                    <div className="p-4 md:p-8">
                      <div className={`flex flex-col gap-1 mb-4 ${isEven ? "md:items-end md:text-right" : ""}`}>
                        <span className="text-sm text-foreground/60">{point.period}</span>
                        <h3 className="text-xl font-bold">{point.title}</h3>
                      </div>
                      <p className={`text-foreground/80 max-w-[50ch] ${isEven ? "md:text-right md:ml-auto" : ""}`}>
                        {point.description}
                      </p>
                    </div>
                  </div>

                  {/* Image */}
                  <div className={`hidden md:block ${isEven ? "order-2" : "order-1"}`}>
                    <div className="p-4 md:p-8 h-full flex items-center justify-center">
                      <div className="relative w-full h-48 rounded-lg overflow-hidden">
                        <Image
                          src={point.image}
                          alt={point.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 40vw"
                          className="object-cover"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Timeline dot */}
                  <div className="absolute left-4 md:left-1/2 top-8 transform -translate-x-1/2 z-10">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
