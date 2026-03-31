export default function Cell({
  row,
  col,
  cellClass,
  handleLeftClick,
  handleRightClick,
  bombsNear,
  isDisabled,
  children,
  ...rest
}) {
  return (
    <button
      className={cellClass}
      onClick={() => handleLeftClick(row, col)}
      onContextMenu={(e) => handleRightClick(e, row, col)}
      data-bombsnear={bombsNear}
      disabled={isDisabled}
    >
      {children}
    </button>
  );
}
