import Image from "next/image";

interface SocialLinkProps {
  href: string;
  src: string;
  label: string;
  donation?: boolean;
}

export function SocialLink({ href, src, label, donation }: SocialLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`inline-flex min-h-10 items-center justify-center gap-1 rounded px-1 text-xs font-medium hover:underline sm:px-2 sm:text-sm ${donation ? "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200" : ""}`}>
      <Image src={src} alt="" width={16} height={16} />
      {label}
    </a>
  );
}
