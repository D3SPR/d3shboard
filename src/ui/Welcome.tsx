import { BRAND } from "../brand";
import { PALETTE_SHORTCUT } from "../commands/shortcut";
import { Icon, Logo, type IconName } from "./icons";
import { Button, Dialog } from "./kit";

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "plus", title: "Add things", text: "Press Add to drop in clocks, notes, news, pictures, live numbers and more." },
  { icon: "move", title: "Move and resize", text: "Drag anything to move it. Tap it once, then pull the dots on its corners to resize." },
  { icon: "pencil", title: "Change anything", text: "Tap the round pencil button (or double-click) on a component to change what it shows and how it looks." },
  { icon: "palette", title: "Set the mood", text: "Theme changes the colours, font and background of the whole page." },
  { icon: "sparkles", title: "Bring it to life", text: "Animate makes things move. Automations change things by themselves, like a dark theme at night." },
  { icon: "eye", title: "Show it off", text: "Press Done to see your finished dashboard. Tap the pencil in the bottom corner to edit again." },
];

export function Welcome({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      onClose={onClose}
      width={500}
      header={
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Logo size={34} />
          <div>
            <h2 className="font-['Unbounded'] text-[17px] font-semibold tracking-tight">Welcome to {BRAND.name}</h2>
            <p className="text-[12.5px] text-white/50">{BRAND.tagline} No account, nothing to install — it all saves on this device.</p>
          </div>
        </div>
      }
      footer={
        <Button variant="primary" className="flex-1 py-2.5" onClick={onClose}>
          Let's go
        </Button>
      }
    >
      <ol className="grid gap-2 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
              <Icon name={s.icon} />
            </span>
            <span>
              <span className="block text-[13px] font-semibold">
                {i + 1}. {s.title}
              </span>
              <span className="block text-[12.5px] leading-snug text-white/55">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-center text-[12px] text-white/40">
        Stuck? Look for the little <span className="rounded-full border border-white/30 px-1">?</span> buttons, or press Help at the top.
      </p>
      <p className="mt-1 text-center text-[12px] text-white/40">
        In a hurry? Press <kbd className="rounded border border-white/20 px-1 text-white/60">{PALETTE_SHORTCUT}</kbd> to do anything by typing.
      </p>
    </Dialog>
  );
}
