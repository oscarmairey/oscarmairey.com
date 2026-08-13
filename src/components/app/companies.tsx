"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Users, Coins, Code, Lightbulb, Presentation } from "lucide-react"
import { motion } from "framer-motion"
import { useInView } from "react-intersection-observer"
import Link from "next/link"

const skills = [
  {
    name: "Software Development",
    icon: <Code className="h-6 w-6 text-primary" />,
    description: "Full-stack React, Next.js, and TypeScript. Built scalable web3 applications.",
    recognition: "Built Raizer App",
    url: "https://raizer.fi",
  },
  {
    name: "Blockchain Development",
    icon: <Users className="h-6 w-6 text-primary" />,
    description: "Smart contracts, DApps, and DeFi with Solidity and Web3.js.",
    recognition: "Hackathon Winner",
    url: "https://www.linkedin.com/posts/chainraizer_this-year-the-chainraizer-team-flew-to-the-activity-7311027473746386945-hXx4?",
  },
  {
    name: "Machine Learning",
    icon: <Lightbulb className="h-6 w-6 text-primary" />,
    description: "PyTorch, TensorFlow, and LLMs applied to real-world problems.",
    recognition: "Automated ML Algorithms",
  },
  {
    name: "Public Speaking",
    icon: <Presentation className="h-6 w-6 text-primary" />,
    description: "Keynotes and workshops on blockchain, AI, and innovation at conferences worldwide.",
    recognition: "CES Speaker",
    url: "https://www.linkedin.com/posts/oscar-mairey_je-naurais-pas-du-%C3%AAtre-sur-cette-sc%C3%A8ne-activity-7018150681257639937-avYF?",
  },
  {
    name: "Communications",
    icon: <Coins className="h-6 w-6 text-primary" />,
    description: "Technical writing and bridging complex ideas for diverse audiences.",
    recognition: "Web3 Communication Manager",
  },
  {
    name: "Community Building",
    icon: <Trophy className="h-6 w-6 text-primary" />,
    description: "Growing and managing tech communities with hundreds of thousands of members.",
    recognition: "Managed 500k Community",
    url: "https://ta-da.io",
  },
]

function SkillCard({ skill }: { skill: typeof skills[number] }) {
  const content = (
    <Card className="group overflow-hidden border border-border/50 bg-card h-full flex flex-col relative hover:shadow-md transition-shadow duration-300">
      <CardContent className="flex-1 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            {skill.icon}
          </div>
          <div>
            <h3 className="text-xl font-bold group-hover:text-primary transition-colors duration-300">
              {skill.name}
            </h3>
            <span className="text-sm font-medium text-primary">{skill.recognition}</span>
          </div>
        </div>
        <p className="text-foreground/70 flex-1">{skill.description}</p>
      </CardContent>
    </Card>
  )

  if (skill.url) {
    return (
      <Link href={skill.url} target="_blank" rel="noopener noreferrer" className="block h-full">
        {content}
      </Link>
    )
  }

  return content
}

export default function Companies() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 },
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
    <section id="companies" className="py-24 relative overflow-hidden">
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
          <p className="text-sm font-medium uppercase tracking-widest text-primary mb-3">What I do</p>
          <h2 className="text-3xl md:text-5xl font-heading">Jack of All Trades</h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {skills.map((skill, index) => (
            <motion.div key={index} variants={itemVariants}>
              <SkillCard skill={skill} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
