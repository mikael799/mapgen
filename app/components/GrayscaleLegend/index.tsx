export const GrayscaleLegend = ({
  left,
  right,
}: {
  left: string;
  right: string;
}) => (
  <div className="flex items-center gap-2 w-full text-xs text-gray-500">
    <span>{left}</span>
    <div
      className="flex-1 h-2 rounded"
      style={{ background: "linear-gradient(to right, #000, #fff)" }}
    />
    <span>{right}</span>
  </div>
);
