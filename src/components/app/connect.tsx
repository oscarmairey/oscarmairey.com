"use client"

import { Github, Linkedin, Twitter, Mail } from "lucide-react"
import { motion } from "framer-motion"
import { useInView } from "react-intersection-observer"
import Link from "next/link"

const socialLinks = [
  { label: "GitHub", icon: Github, url: "https://github.com/cesarioo", external: true },
  { label: "LinkedIn", icon: Linkedin, url: "https://linkedin.com/in/oscarmairey", external: true },
  { label: "Twitter", icon: Twitter, url: "https://twitter.com/cesarioo__", external: true },
  { label: "Email", icon: Mail, url: "mailto:o@mairey.net", external: false },
]

export default function Connect() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section id="connect" className="py-24 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
        >
          <h2 className="text-3xl md:text-5xl font-heading">Let&apos;s Connect</h2>

          <div className="flex items-center gap-4">
            {socialLinks.map((s) => (
              <Link
                key={s.label}
                href={s.url}
                {...(s.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-label={s.label}
                className="text-foreground/50 hover:text-primary transition-colors duration-300"
              >
                <s.icon className="h-7 w-7 md:h-8 md:w-8" />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
