"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CloudShader } from "@/components/ui/cloud-shader";
import { LiquidGlassLayer } from "@/components/ui/liquid-glass";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export function PlaneWindowHero() {
  const isMobile = useIsMobile();

  return (
    <section className="relative h-dvh w-full overflow-hidden bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 px-2 pt-6 md:px-8 md:pt-10">
      <div className="h-[105dvh] w-full rounded-t-[56px] bg-neutral-950 p-0.5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9),0_12px_32px_rgba(0,0,0,0.6)] md:rounded-t-[200px]">
        <div className="relative h-full overflow-hidden rounded-t-[54px] bg-neutral-900 p-4 shadow-[inset_0_2px_4px_rgba(255,255,255,0.12),inset_0_-8px_20px_rgba(0,0,0,0.55)] md:rounded-t-[198px] md:p-8">
          <div aria-hidden className="absolute inset-0">
            <div className="absolute inset-0 [clip-path:polygon(0_0,100%_0,50%_50%)] [perspective:2000px]">
              <div className="absolute -inset-x-1/4 inset-y-0 origin-top [transform:rotateX(-40deg)] bg-[radial-gradient(circle,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:16px_16px]" />
            </div>
            <div className="absolute inset-0 [clip-path:polygon(0_100%,100%_100%,50%_50%)] [perspective:2000px]">
              <div className="absolute -inset-x-1/4 inset-y-0 origin-bottom [transform:rotateX(40deg)] bg-[radial-gradient(circle,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:16px_16px]" />
            </div>
            <div className="absolute inset-0 [clip-path:polygon(0_0,0_100%,50%_50%)] [perspective:2000px]">
              <div className="absolute inset-x-0 -inset-y-1/4 origin-left [transform:rotateY(40deg)] bg-[radial-gradient(circle,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:16px_16px]" />
            </div>
            <div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,50%_50%)] [perspective:2000px]">
              <div className="absolute inset-x-0 -inset-y-1/4 origin-right [transform:rotateY(-40deg)] bg-[radial-gradient(circle,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:16px_16px]" />
            </div>
          </div>

          <div className="relative h-full overflow-hidden rounded-t-[38px] bg-gradient-to-t from-[#7eb6dc] to-[#2f6aa8] md:rounded-t-[166px]">
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            >
              <div className="absolute h-1/2 w-1/2 origin-top-left scale-[2]">
                <CloudShader
                  speed={1}
                  count={isMobile ? 3 : 6}
                  className="absolute inset-0"
                />
              </div>
            </motion.div>

            {!isMobile && (
              <LiquidGlassLayer
                className="absolute inset-0 z-[15]"
                radius={166}
                bevelDepth={44}
                aberration={0}
                frost={0}
              />
            )}

            <nav className="relative z-30 mx-auto flex w-full max-w-7xl items-center justify-between px-6 pt-8 md:px-20 md:pt-12">
              <div className="flex items-center gap-8">
                <span className="text-lg font-semibold tracking-tight text-white">
                  Aegis
                </span>
                <div className="hidden items-center gap-6 text-sm font-medium text-white/90 md:flex">
                  <a href="#how-it-works" className="transition hover:text-white">
                    How it works
                  </a>
                  <a href="#capabilities" className="transition hover:text-white">
                    Capabilities
                  </a>
                  <Link href="/cases" className="transition hover:text-white">
                    Cases
                  </Link>
                </div>
              </div>
              <Link
                href="/login"
                className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-neutral-950 transition hover:bg-white/90"
              >
                Sign in
              </Link>
            </nav>

            <div className="relative z-20 mx-auto mt-10 w-full max-w-7xl px-6 md:mt-24 md:px-20">
              <div className="max-w-2xl">
                <p className="font-display text-5xl font-semibold tracking-tight text-white [text-shadow:0_2px_16px_rgba(15,42,67,0.4)] md:text-7xl lg:text-8xl">
                  Aegis
                </p>
                <h1 className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-white/95 [text-shadow:0_2px_12px_rgba(15,42,67,0.35)] md:text-4xl">
                  The web, working for you.
                </h1>
                <p className="mt-4 max-w-md text-base text-balance text-white/85 md:text-lg">
                  Turn messy consumer problems into evidence-backed cases.
                  Ask before anything consequential. Execute through WebMCP.
                  Verify what actually happened.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link href="/dashboard">
                    <HoverBorderGradient
                      as="div"
                      containerClassName="rounded-full"
                      className="flex items-center gap-2 bg-neutral-950 px-6 py-3 text-sm font-semibold text-white"
                    >
                      Open Command Center
                    </HoverBorderGradient>
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </div>

            <motion.div
              className="pointer-events-none absolute -bottom-6 left-0 z-10 w-[85%] md:w-[70%]"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://assets.aceternity.com/components/plane-wing.png"
                alt=""
                className="h-auto w-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
