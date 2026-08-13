"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { useInView } from "react-intersection-observer"

export default function Story() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section id="story" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-muted/30 dark:bg-muted/10">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="text-sm font-medium uppercase tracking-widest text-primary mb-3">
            About
          </p>
          <h2 className="text-3xl md:text-5xl font-heading">
            The Journey So Far
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {/* Mobile: single image */}
            <div className="md:hidden relative aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src="/conference.jpeg"
                alt="Oscar Mairey at a conference"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            {/* Desktop: layered collage */}
            <div className="hidden md:block relative h-[500px] lg:h-[600px] w-full">
              <div className="absolute top-[10%] left-[5%] w-[70%] h-[60%] rounded-2xl overflow-hidden z-10 transform -rotate-6">
                <Image
                  src="/people.png"
                  alt="Team collaboration"
                  fill
                  sizes="35vw"
                  className="object-cover"
                />
              </div>

              <div className="absolute top-[15%] left-[15%] w-[80%] h-[70%] rounded-2xl overflow-hidden z-20">
                <Image
                  src="/conference.jpeg"
                  alt="Oscar Mairey speaking"
                  fill
                  sizes="40vw"
                  className="object-cover"
                />
              </div>

              <div className="absolute bottom-[10%] right-[5%] w-[50%] h-[40%] rounded-2xl overflow-hidden z-30">
                <Image
                  src="/burj.png"
                  alt="Dubai"
                  fill
                  sizes="25vw"
                  className="object-cover"
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="space-y-5 max-w-[55ch]">
              <p className="text-foreground/80 leading-relaxed text-lg">
                I discovered stoicism early in my youth, and it shaped how I see everything. We all leave this world eventually — so the real game is making an impact that outlasts you.
              </p>
              <p className="text-foreground/80 leading-relaxed text-lg">
                Technology, to me, is a form of art that raises moral questions in its application. The best philosophers were also engineers — from Archimedes to Wittgenstein. They would have had a lot to say about AI consciousness.
              </p>
              <p className="text-foreground/80 leading-relaxed text-lg">
                I fell in love with crypto around 2020 — the combination of cryptography, game theory, and economic incentives opened my eyes to new ways of organizing human cooperation. That led me deeper into AI, and now into deep tech as a whole.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
