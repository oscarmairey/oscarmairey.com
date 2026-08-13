"use client"

import { motion } from "framer-motion"

export default function Hero() {
  return (
    <section id="home" className="relative min-h-screen flex items-end pb-24 sm:pb-32 overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h1
          className="text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] xl:text-[12rem] font-heading tracking-tight leading-[0.9]"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          Oscar
          <br />
          <span className="text-primary">Mairey</span>
        </motion.h1>

        <motion.p
          className="mt-6 sm:mt-8 text-sm md:text-base font-light uppercase tracking-[0.25em] text-foreground/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          Entrepreneur &middot; Builder &middot; Deep Tech
        </motion.p>
      </div>
    </section>
  )
}
