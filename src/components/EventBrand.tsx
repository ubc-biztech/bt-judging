import { useState } from "react";
import { EVENT, getEventInitials } from "@/lib/event";

export default function EventBrand({
  name,
  imageUrl,
  className = "h-12 w-auto",
  eventID = EVENT.id,
}: {
  name: string;
  imageUrl?: string;
  className?: string;
  eventID?: string;
}) {
  const [failed, setFailed] = useState("");
  const src = imageUrl || (eventID === "hellohacks" ? "/hh.svg" : "");
  if (!src || failed === src)
    return (
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-lg bg-blue-500/10 text-xl font-semibold text-blue-500"
      >
        {getEventInitials(name)}
      </span>
    );
  // Event images are public uploads; native images also support existing external URLs.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={`${className} max-w-full object-contain`}
      onError={() => setFailed(src)}
    />
  );
}
