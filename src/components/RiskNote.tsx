import type { JSX } from 'react';
import type { RiskNote as RiskNoteModel } from '@/types/domain';

/** One risk with its triggering value and source, always readable as words. */
export function RiskNote({ note }: { note: RiskNoteModel }): JSX.Element {
  const className =
    note.severity === 'high' ? 'risk-note' : `risk-note risk-note--${note.severity}`;
  return (
    <div className={className} role="note">
      <strong>{note.type}</strong> ({note.severity}) — {note.plainText}
      <div className="source-label">
        Source: {note.source} · {note.freshness}
      </div>
    </div>
  );
}
