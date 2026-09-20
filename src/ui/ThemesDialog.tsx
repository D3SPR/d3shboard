import { useState } from "react";
import { THEMES } from "../themes";
import { backgroundCss } from "../lib/board";
import { Dialog, Field, Intro, Toggle } from "./kit";

export function ThemesDialog({
  currentAccent,
  onPick,
  onClose,
}: {
  currentAccent: string;
  onPick: (themeId: string, restyleComponents: boolean) => void;
  onClose: () => void;
}) {
  const [restyle, setRestyle] = useState(true);

  return (
    <Dialog
      title="Themes"
      subtitle="A whole look in one click — colours, font, background and card style."
      icon="palette"
      onClose={onClose}
      width={620}
    >
      <Intro>Themes change how this page looks, never what's on it.</Intro>

      <Field
        label="Restyle the components too"
        help="Gives every component on this page the theme's card look. Turn this off to change only the background, colour and font."
      >
        <Toggle checked={restyle} onChange={setRestyle} label="Restyle the components too" />
      </Field>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onPick(theme.id, restyle)}
            className={`overflow-hidden rounded-xl border text-left transition hover:border-[var(--accent)]/60 ${
              currentAccent.toLowerCase() === theme.accent.toLowerCase() ? "border-[var(--accent)]/50" : "border-white/10"
            }`}
          >
            <span className="relative flex h-24 items-center justify-center" style={backgroundCss(theme.background)}>
              <span
                className="flex h-14 w-[70%] flex-col justify-center gap-1.5 px-3"
                style={{
                  background: theme.card.bg,
                  color: theme.card.fg,
                  border: `${theme.card.borderWidth}px solid ${theme.card.border}`,
                  borderRadius: theme.card.radius,
                  backdropFilter: theme.card.blur ? "blur(8px)" : undefined,
                  boxShadow: theme.card.shadow === "glow" ? `0 0 26px -6px ${theme.accent}` : theme.card.shadow === "hard" ? "6px 6px 0 rgba(0,0,0,.5)" : theme.card.shadow === "soft" ? "0 12px 28px -14px rgba(0,0,0,.8)" : undefined,
                  fontFamily: `"${theme.fontFamily}", system-ui`,
                }}
              >
                <span className="text-[13px] font-semibold leading-none">20:45</span>
                <span className="h-1.5 w-2/3 rounded-full" style={{ background: theme.accent }} />
              </span>
            </span>
            <span className="block px-3 py-2">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: theme.accent }} />
                <span className="text-[13px] font-semibold">{theme.name}</span>
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-white/50">{theme.description}</span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
