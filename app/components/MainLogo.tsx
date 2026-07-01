"use client";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);
function MainLogo({ isLoading }: { isLoading: boolean }) {
  const SVGRef = useRef(null);
  useGSAP(
    () => {
      const tl = gsap.timeline({
        delay: 0.7,
        // repeat: -1,
        repeat: isLoading ? -1 : 0,
      });
      tl.to(".green", {
        x: 16,
        ease: "power1.out",
      }).to(".green", {
        x: -2,
        ease: "power2.in",
      });
    },
    { scope: SVGRef },
  );
  return (
    <svg
      ref={SVGRef}
      className="inline-block overflow-visible"
      width="32"
      height="24"
      viewBox="0 0 32 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="24"
        width="24"
        className="green"
        height="24"
        rx="12"
        transform="rotate(90 24 0)"
        fill="#8DDC5F"
      />
      <rect
        x="32"
        width="24"
        height="24"
        rx="12"
        transform="rotate(90 32 0)"
        fill="#8DDC5F"
        className="littlegreen"
        fillOpacity="0.51"
      />
    </svg>
  );
}

export default MainLogo;
