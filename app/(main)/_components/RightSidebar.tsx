"use client";

export default function RightSidebar() {
  return (
    <div className="hidden w-[320px] border-l border-white/10 bg-[#23263a] p-6 xl:block">
      <h2 className="mb-6 text-2xl font-semibold text-white">Shared Media</h2>

      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-32 rounded-2xl bg-gradient-to-br from-cyan-400/40 to-purple-500/40"
          />
        ))}
      </div>

      <div className="mt-10">
        <h2 className="mb-6 text-2xl font-semibold text-white">Files</h2>

        <div className="space-y-4">
          {["Design.fig", "Meeting.docx", "Project.zip"].map((file) => (
            <div
              key={file}
              className="flex items-center justify-between rounded-2xl bg-[#2b2f46] p-4"
            >
              <div>
                <p className="text-white">{file}</p>

                <p className="text-sm text-gray-400">2.4 MB</p>
              </div>

              <button className="text-xl text-cyan-400">⬇️</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
