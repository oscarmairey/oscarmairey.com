"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Github, Linkedin, Mail, Twitter } from "lucide-react"
import { motion } from "framer-motion"
import { useInView } from "react-intersection-observer"

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <footer className="py-12 relative overflow-hidden">

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row justify-between items-center"
        >
          <div className="mb-6 md:mb-0">
            <Link href="#home" className="text-xl font-bold tracking-tight">
              Oscar<span className="text-primary">Mairey</span>
            </Link>
          </div>

          <div className="flex space-x-4">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors duration-300"
            >
              <Link href="https://github.com/cesarioo" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <Github className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors duration-300"
            >
              <Link
                href="https://linkedin.com/in/oscarmairey"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors duration-300"
            >
              <Link
                href="https://twitter.com/cesarioo__"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors duration-300"
            >
              <Link href="mailto:o@mairey.net" aria-label="Email">
                <Mail className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="border-t border-border/20 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center"
        >
          <p className="text-foreground/60 text-sm">© {currentYear} Oscar Mairey. All rights reserved.</p>

          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href="mailto:o@mairey.net" className="text-sm text-foreground/60 hover:text-primary transition-colors">
              Contact
            </Link>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}

