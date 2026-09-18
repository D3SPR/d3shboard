import { TEMPLATES } from "../templates";
import { Icon } from "./icons";
import { Dialog, Intro } from "./kit";

export function TemplatesDialog({ onPick, onClose }: { onPick: (templateId: string) => void; onClose: () => void }) {
  return (
    <Dialog
      title="Start from a template"
      subtitle="A ready-made page you can change however you like."
      icon="pages"
      onClose={onClose}
      width={560}
    >
      <Intro>
        Each one is added as a new page, so nothing you already have is touched. Everything on it can be moved, restyled or
        deleted afterwards.
      </Intro>
      <div className="grid gap-2 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t.id)}
            className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-[var(--accent)]/60 hover:bg-white/[0.07]"
          >
            <span className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                <Icon name={t.icon} size={15} />
              </span>
              <span className="text-[13.5px] font-semibold">{t.name}</span>
            </span>
            <span className="text-[12px] leading-snug text-white/55">{t.description}</span>
            {t.widgets.length ? (
              <span className="mt-0.5 flex flex-wrap gap-1">
                {t.widgets.map((w, i) => (
                  <span key={i} className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10.5px] text-white/60">
                    {w.title}
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </Dialog>
  );
}
