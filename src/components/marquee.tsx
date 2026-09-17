type MarqueeItem = {
  icon: string;
  title: string;
  desc: string;
};

export function Marquee({ items }: { items: MarqueeItem[] }) {
  return (
    <div className="w-full overflow-hidden border-y border-black/5 bg-white/40 py-4 backdrop-blur-md">
      <div className="flex w-max animate-marquee gap-12 hover:[animation-play-state:paused]">
        <ul className="flex items-center gap-12">
          {items.map((item, i) => (
            <li
              key={`a-${i}`}
              className="flex shrink-0 items-center gap-3 whitespace-nowrap"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm text-softslate">
                <b className="font-black text-teal-700">{item.title}</b>
                <span className="mx-2 text-sage-500">•</span>
                {item.desc}
              </span>
            </li>
          ))}
        </ul>
        <ul className="flex items-center gap-12" aria-hidden="true">
          {items.map((item, i) => (
            <li
              key={`b-${i}`}
              className="flex shrink-0 items-center gap-3 whitespace-nowrap"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm text-softslate">
                <b className="font-black text-teal-700">{item.title}</b>
                <span className="mx-2 text-sage-500">•</span>
                {item.desc}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}