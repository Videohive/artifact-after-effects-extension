import React from 'react';

type ProjectMetadataPanelProps = {
  previewWidth: number | string;
  projectTitle: string;
  projectTags: string;
  projectDescription: string;
  mediaPlaceholderCount: number;
  textPlaceholderCount: number;
  fontEntries: Array<{ name: string; styles: string[] }>;
  fontsLoading: boolean;
  editingTitle: boolean;
  editingTags: boolean;
  editingDescription: boolean;
  titleDraft: string;
  tagsDraft: string;
  descriptionDraft: string;
  onTitleDraftChange: (value: string) => void;
  onTagsDraftChange: (value: string) => void;
  onDescriptionDraftChange: (value: string) => void;
  onTitleEditStart: () => void;
  onTagsEditStart: () => void;
  onDescriptionEditStart: () => void;
  onTitleEditCancel: () => void;
  onTagsEditCancel: () => void;
  onDescriptionEditCancel: () => void;
  onTitleSave: () => void;
  onTagsSave: () => void;
  onDescriptionSave: () => void;
};

export const ProjectMetadataPanel: React.FC<ProjectMetadataPanelProps> = ({
  previewWidth,
  projectTitle,
  projectTags,
  projectDescription,
  mediaPlaceholderCount,
  textPlaceholderCount,
  fontEntries,
  fontsLoading,
  editingTitle,
  editingTags,
  editingDescription,
  titleDraft,
  tagsDraft,
  descriptionDraft,
  onTitleDraftChange,
  onTagsDraftChange,
  onDescriptionDraftChange,
  onTitleEditStart,
  onTagsEditStart,
  onDescriptionEditStart,
  onTitleEditCancel,
  onTagsEditCancel,
  onDescriptionEditCancel,
  onTitleSave,
  onTagsSave,
  onDescriptionSave
}) => {
  return (
    <div className="shrink-0 w-full flex justify-center px-4">
      <div
        className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4"
        style={{ width: previewWidth || '100%' }}
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Project</div>
        <div className="mt-2">
          {editingTitle ? (
            <input
              value={titleDraft}
              onChange={(e) => onTitleDraftChange(e.target.value)}
              onBlur={onTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') onTitleEditCancel();
              }}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-lg font-semibold text-white focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={onTitleEditStart}
              className="text-left text-lg font-semibold text-white hover:text-indigo-300"
            >
              {projectTitle || 'Untitled Project'}
            </button>
          )}
        </div>
        <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</div>
        <div className="mt-1">
          {editingDescription ? (
            <textarea
              value={descriptionDraft}
              onChange={(e) => onDescriptionDraftChange(e.target.value)}
              onBlur={onDescriptionSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') onDescriptionEditCancel();
              }}
              rows={3}
              placeholder="Short SEO description for stock listing"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={onDescriptionEditStart}
              className="text-left text-sm text-neutral-300 hover:text-indigo-300"
            >
              {projectDescription || 'Add description'}
            </button>
          )}
        </div>
        <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Placeholders</div>
        {mediaPlaceholderCount > 0 || textPlaceholderCount > 0 ? (
          <div className="mt-1 text-sm text-neutral-300">
            {mediaPlaceholderCount > 0 ? `${mediaPlaceholderCount} Media placeholder` : null}
            {mediaPlaceholderCount > 0 && textPlaceholderCount > 0 ? ', ' : null}
            {textPlaceholderCount > 0 ? `${textPlaceholderCount} Text placeholder` : null}
          </div>
        ) : null}
        <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Tags</div>
        <div className="mt-1">
          {editingTags ? (
            <input
              value={tagsDraft}
              onChange={(e) => onTagsDraftChange(e.target.value)}
              onBlur={onTagsSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') onTagsEditCancel();
              }}
              placeholder="tag1, tag2, tag3"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={onTagsEditStart}
              className="text-left text-sm text-neutral-300 hover:text-indigo-300"
            >
              {projectTags || 'Add tags'}
            </button>
          )}
        </div>
        <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Fonts</div>
        <div className="mt-1 text-sm text-neutral-300">
          {fontsLoading ? (
            <div className="text-neutral-500">Loading fonts...</div>
          ) : fontEntries.length ? (
            <div className="flex flex-col gap-1">
              {fontEntries.map((font) => {
                const styles = font.styles && font.styles.length ? font.styles.join(', ') : 'Regular';
                return (
                  <div key={font.name}>
                    {font.name} - {styles}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-neutral-500">No fonts detected</div>
          )}
        </div>
      </div>
    </div>
  );
};
