import Image from "next/image";

interface SocialLinkProps {
  href: string;
  src: string;
  alt: string;
  ariaLabel: string;
}

export function SocialLink({ href, src, alt, ariaLabel }: SocialLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className="hidden sm:flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent"
    >
      <Image src={src} alt={alt} width={24} height={24} />
    </a>
  );
}
