"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Monopoly3DScene from "./Board3D";
import DiceRoller3D from "./DiceRoller3D";
import { BuyModal, JailModal } from "./GameModals";
import { useGame } from "../_context/GameContext";
import { useOptionalRoom } from "../_context/RoomContext";
import PlayerCards from "./PlayerCards";
import FestivalModal from "./FestivalModal";
import CardModal from "./CardModal";
import TaxNotification from "./TaxNotification";
import TravelOverlay from "./TravelOverlay";
import SellPropertyModal from "./SellPropertyModal";
import WinnerModal from "./WinnerModal";
import BankruptNotification from "./BankruptNotification";
import GameChat from "./GameChat";
import TurnStatusBar from "./TurnStatusBar";
import RpsModal from "./RpsModal";
import XocDiaModal from "./XocDiaModal";
import RentNotification from "./RentNotification";
import { useIsCompact } from "./ui/useScreen";
import RotateDeviceOverlay from "./ui/RotateDeviceOverlay";
import VoiceControls from "./VoiceControls";

export default function GameBoard() {
  const {
    board,
    players,
    currPlayer,
    pawnStates,
    showBuyModal,
    showJailModal,
    currentTile,
    calculateTileRent,
    handleTravelToTile,
    handleRollComplete,
    handleBuyProperty,
    handleSkipBuy,
    handlePayJailBail,
    showSellModal,
    winner,
    handleSellTile,
    handleAutoSellAll,
    isMyTurn,
    turnPhase,
  } = useGame();
  const roomCtx = useOptionalRoom();
  const isCompact = useIsCompact();

  const canRoll = isMyTurn && turnPhase === "roll" && !currPlayer.inJail;

  // ---- Props ổn định cho bàn cờ 3D (tránh vẽ lại khi state khác thay đổi) ----
  const scenePlayers = useMemo(
    () =>
      players.map((p) => ({
        id: p.id,
        type: p.type,
        color: p.color,
        tileIndex: p.tileIndex,
        isBankrupt: p.isBankrupt,
      })),
    [players],
  );
  const sceneTiles = useMemo(
    () => board.map((t) => ({ ...t, currentRent: calculateTileRent(t) })),
    // calculateTileRent chỉ phụ thuộc vào board
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board],
  );
  const travelRef = useRef(handleTravelToTile);
  useEffect(() => {
    travelRef.current = handleTravelToTile;
  });
  const onTileSelect = useCallback(
    (tileId: number) => void travelRef.current(tileId),
    [],
  );
  const isTravelSelecting =
    isMyTurn && currPlayer.canTeleport && !currPlayer.inJail;

  const handleLeave = () => {
    if (!roomCtx) return;
    const inGame = !winner && roomCtx.room?.status === "playing";
    if (
      inGame &&
      !window.confirm("Rời phòng lúc này sẽ bị xử thua. Bạn chắc chắn chứ?")
    )
      return;
    void roomCtx.leaveRoom();
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#0c0d14] text-white select-none">
      <div className="absolute inset-0 z-0">
        <Monopoly3DScene
          players={scenePlayers}
          tiles={sceneTiles}
          pawnStates={pawnStates}
          isTravelSelecting={isTravelSelecting}
          onTileSelect={onTileSelect}
        />
      </div>

      {/* Điện thoại cầm dọc -> nhắc xoay ngang (bàn cờ luôn chơi ngang) */}
      <RotateDeviceOverlay />

      {/* Hiển thị thẻ thông tin người chơi */}
      <PlayerCards />

      {/* Khung chat (phải) */}
      {roomCtx && <GameChat />}
      {/* Voice chat (giữ nguyên nếu đã bật ở phòng chờ) */}
      <VoiceControls variant="game" />

      {/* Bên trái (dưới thẻ người chơi góc trái): mã phòng & rời phòng */}
      {roomCtx && (
        <div
          className={`absolute z-30 flex items-center rounded-2xl border border-white/10 bg-black/80 ${
            isCompact
              ? "left-1.5 top-[48px] gap-1 px-2 py-1 text-[11px]"
              : "left-4 top-[100px] gap-2 px-3 py-1.5 text-xs"
          }`}
        >
          {!isCompact && <span className="text-gray-400">Phòng</span>}
          <span className="font-mono font-bold tracking-widest text-cyan-300">
            {roomCtx.code}
          </span>
          <button
            onClick={handleLeave}
            title="Rời phòng"
            className="ml-1 rounded-lg bg-white/10 px-2 py-1 text-gray-300 transition hover:bg-rose-500/30 hover:text-white"
          >
            🚪{!isCompact && " Rời phòng"}
          </button>
        </div>
      )}

      {/* Bên phải (dưới thẻ người chơi góc phải): lượt hiện tại / kết quả xúc xắc */}
      <div
        className={`pointer-events-none absolute z-30 ${
          isCompact
            ? "right-1.5 top-[48px] max-w-[60%] [@media(max-height:500px)]:max-w-[180px]"
            : "right-4 top-[100px] max-w-[340px]"
        }`}
      >
        <TurnStatusBar />
      </div>

      {/* Chế độ Du lịch */}
      <TravelOverlay />

      {/* ===== Modal thao tác: chỉ người đang tới lượt mới thấy ===== */}
      {isMyTurn && showBuyModal && (
        <BuyModal
          currentTile={currentTile}
          currPlayer={currPlayer}
          onBuy={handleBuyProperty}
          onSkip={handleSkipBuy}
          calculateTileRent={calculateTileRent}
        />
      )}

      {isMyTurn && showJailModal && turnPhase === "roll" && (
        <JailModal
          currPlayer={currPlayer}
          onPayBail={handlePayJailBail}
          onRollComplete={handleRollComplete}
        />
      )}

      {isMyTurn && <FestivalModal />}

      {isMyTurn && showSellModal && (
        <SellPropertyModal
          currPlayer={currPlayer}
          board={board}
          onSellTile={handleSellTile}
          onAutoSellAll={handleAutoSellAll}
        />
      )}

      {/* ===== Thông báo: mọi người đều thấy ===== */}
      <CardModal />
      {/* Mini game Oẳn tù tì: mọi người chơi đều thấy & tham gia */}
      <RpsModal />
      {/* Mini game Xóc đĩa chẵn / lẻ */}
      <XocDiaModal />
      <TaxNotification />
      {/* Trả tiền thuê: banner phía trên, không chặn thao tác */}
      <RentNotification />
      <BankruptNotification />

      {/* Người chiến thắng */}
      {winner &&
        (roomCtx ? (
          <WinnerModal
            winner={winner}
            canRestart={roomCtx.isHost}
            restartLabel="🔄 Về phòng chờ & chơi ván mới"
            onRestart={() => void roomCtx.resetToLobby()}
            onLeave={() => void roomCtx.leaveRoom()}
          />
        ) : (
          <WinnerModal winner={winner} />
        ))}

      {/* Bộ Lắc Xúc Xắc: luôn ở giữa bàn cờ (điện thoại thu nhỏ lại để không che ô) */}
      {canRoll && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <div
            className={`pointer-events-auto ${
              isCompact
                ? "w-72 scale-[0.66] [@media(max-height:500px)]:scale-[0.6]"
                : "w-80"
            }`}
          >
            <DiceRoller3D onRollComplete={handleRollComplete} />
          </div>
        </div>
      )}
    </div>
  );
}
