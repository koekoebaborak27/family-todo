import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth";
import {
  createUnregisteredMemberRow,
  deleteFamilyRow,
  deleteUnregisteredMemberRow,
  createFamilyRow,
  findFamilyById,
  findFamilyByInviteCode,
  findOldestFamilyMemberExcept,
  leaveFamilyRow,
  listFamilyMembers,
  listUnregisteredFamilyMembers,
  setUserFamilyId,
  updateFamilyCreator,
  updateInviteCode,
} from "./repository";
import {
  addMyUnregisteredFamilyMember,
  createFamily,
  deleteMyFamily,
  getMyFamily,
  getMyFamilyMembers,
  getMyUnregisteredFamilyMembers,
  joinFamily,
  leaveMyFamily,
  removeMyUnregisteredFamilyMember,
  renewMyFamilyInviteCode,
} from "./service";

/**
 * 対象: family/service
 * 目的: 家族グループの新規作成・招待コード参加の業務ルール（未所属ユーザーのみ実行可能・
 *       招待コードの重複回避・有効期限切れの判定）と、所属グループ情報取得（グループ未所属・
 *       家族グループが見つからない場合の扱い）を担保する。
 */

vi.mock("./repository", () => ({
  findFamilyByInviteCode: vi.fn(),
  findFamilyById: vi.fn(),
  createFamilyRow: vi.fn(),
  createUnregisteredMemberRow: vi.fn(),
  deleteUnregisteredMemberRow: vi.fn(),
  deleteFamilyRow: vi.fn(),
  findOldestFamilyMemberExcept: vi.fn(),
  leaveFamilyRow: vi.fn(),
  listFamilyMembers: vi.fn(),
  listUnregisteredFamilyMembers: vi.fn(),
  updateFamilyCreator: vi.fn(),
  updateInviteCode: vi.fn(),
  setUserFamilyId: vi.fn(),
}));

const unaffiliatedUser: AuthenticatedUser = { id: 1, familyId: null };
const affiliatedUser: AuthenticatedUser = { id: 2, familyId: 99 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("family/service createFamily", () => {
  describe("正常系", () => {
    it("グループを作成し、自分をそのグループのメンバーにする", async () => {
      vi.mocked(findFamilyByInviteCode).mockResolvedValue(null);
      vi.mocked(createFamilyRow).mockResolvedValue({ id: 10, name: "山田家" });

      const result = await createFamily({ name: "山田家" }, unaffiliatedUser);

      expect(createFamilyRow).toHaveBeenCalledWith(
        expect.objectContaining({ name: "山田家", createdByUserId: 1 }),
      );
      expect(setUserFamilyId).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual({ id: 10, name: "山田家" });
    });
  });

  describe("生成した招待コードが既存のものと重複したとき", () => {
    it("重複しないコードが見つかるまで生成をやり直す", async () => {
      vi.mocked(findFamilyByInviteCode)
        .mockResolvedValueOnce({ id: 999, name: "他家", invite_code_expires_at: "2099-01-01" })
        .mockResolvedValueOnce(null);
      vi.mocked(createFamilyRow).mockResolvedValue({ id: 11, name: "佐藤家" });

      await createFamily({ name: "佐藤家" }, unaffiliatedUser);

      expect(findFamilyByInviteCode).toHaveBeenCalledTimes(2);
    });

    it("既定回数（5回）試しても重複が解消しなければ例外を投げる", async () => {
      vi.mocked(findFamilyByInviteCode).mockResolvedValue({
        id: 999,
        name: "他家",
        invite_code_expires_at: "2099-01-01",
      });

      await expect(createFamily({ name: "佐藤家" }, unaffiliatedUser)).rejects.toThrow();
      expect(createFamilyRow).not.toHaveBeenCalled();
    });
  });

  describe("既に家族グループに所属しているとき", () => {
    it("AppError(CONFLICT) を投げ、作成は行わない", async () => {
      await expect(createFamily({ name: "山田家" }, affiliatedUser)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(createFamilyRow).not.toHaveBeenCalled();
    });
  });
});

describe("family/service joinFamily", () => {
  describe("正常系", () => {
    it("招待コードに一致するグループへ参加する", async () => {
      vi.mocked(findFamilyByInviteCode).mockResolvedValue({
        id: 20,
        name: "鈴木家",
        invite_code_expires_at: "2099-01-01T00:00:00.000Z",
      });

      const result = await joinFamily({ inviteCode: "A3F9K2QP" }, unaffiliatedUser);

      expect(setUserFamilyId).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual({ id: 20, name: "鈴木家" });
    });
  });

  describe("招待コードに一致するグループが無いとき", () => {
    it("AppError(NOT_FOUND) を投げる", async () => {
      vi.mocked(findFamilyByInviteCode).mockResolvedValue(null);

      await expect(joinFamily({ inviteCode: "A3F9K2QP" }, unaffiliatedUser)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(setUserFamilyId).not.toHaveBeenCalled();
    });
  });

  describe("招待コードの有効期限が切れているとき", () => {
    it("AppError(VALIDATION_ERROR) を投げる", async () => {
      vi.mocked(findFamilyByInviteCode).mockResolvedValue({
        id: 20,
        name: "鈴木家",
        invite_code_expires_at: "2000-01-01T00:00:00.000Z",
      });

      await expect(joinFamily({ inviteCode: "A3F9K2QP" }, unaffiliatedUser)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
      expect(setUserFamilyId).not.toHaveBeenCalled();
    });
  });

  describe("既に家族グループに所属しているとき", () => {
    it("AppError(CONFLICT) を投げ、招待コードの検索は行わない", async () => {
      await expect(joinFamily({ inviteCode: "A3F9K2QP" }, affiliatedUser)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(findFamilyByInviteCode).not.toHaveBeenCalled();
    });
  });
});

describe("family/service getMyFamily", () => {
  describe("グループ未所属のとき", () => {
    it("AppError(FORBIDDEN) を投げ、repositoryは呼ばない", async () => {
      await expect(getMyFamily(unaffiliatedUser)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(findFamilyById).not.toHaveBeenCalled();
    });
  });

  describe("所属しているはずの家族グループが見つからないとき", () => {
    it("AppError(NOT_FOUND) を投げる", async () => {
      vi.mocked(findFamilyById).mockResolvedValue(null);

      await expect(getMyFamily(affiliatedUser)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("正常系", () => {
    it("所属している家族グループの詳細を返す", async () => {
      vi.mocked(findFamilyById).mockResolvedValue({
        id: 99,
        name: "山田家",
        invite_code: "A3F9K2QP",
        invite_code_expires_at: "2099-01-01T00:00:00.000Z",
        created_by_user_id: 2,
        created_at: "2026-01-01T00:00:00.000Z",
      });

      const result = await getMyFamily(affiliatedUser);

      expect(findFamilyById).toHaveBeenCalledWith(99);
      expect(result).toEqual({
        id: 99,
        name: "山田家",
        inviteCode: "A3F9K2QP",
        inviteCodeExpiresAt: "2099-01-01T00:00:00.000Z",
        createdByUserId: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });
  });
});

describe("family/service getMyFamilyMembers", () => {
  describe("正常系", () => {
    it("所属グループのメンバー一覧を、自分自身の判定を付けて返す", async () => {
      vi.mocked(listFamilyMembers).mockResolvedValue([
        { id: 2, display_name: "花子" },
        { id: 3, display_name: "太郎" },
      ]);

      const result = await getMyFamilyMembers(affiliatedUser);

      expect(listFamilyMembers).toHaveBeenCalledWith(99);
      expect(result).toEqual([
        { id: 2, displayName: "花子", isCurrentUser: true },
        { id: 3, displayName: "太郎", isCurrentUser: false },
      ]);
    });
  });

  describe("グループ未所属のとき", () => {
    it("AppError(FORBIDDEN) を投げ、repositoryは呼ばない", async () => {
      await expect(getMyFamilyMembers(unaffiliatedUser)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(listFamilyMembers).not.toHaveBeenCalled();
    });
  });
});

describe("family/service getMyUnregisteredFamilyMembers", () => {
  describe("正常系", () => {
    it("所属グループの非登録メンバー一覧を返す", async () => {
      vi.mocked(listUnregisteredFamilyMembers).mockResolvedValue([{ id: 8, name: "太郎" }]);

      const result = await getMyUnregisteredFamilyMembers(affiliatedUser);

      expect(listUnregisteredFamilyMembers).toHaveBeenCalledWith(99);
      expect(result).toEqual([{ id: 8, name: "太郎" }]);
    });
  });

  describe("グループ未所属のとき", () => {
    it("AppError(FORBIDDEN) を投げ、repositoryは呼ばない", async () => {
      await expect(getMyUnregisteredFamilyMembers(unaffiliatedUser)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(listUnregisteredFamilyMembers).not.toHaveBeenCalled();
    });
  });
});

describe("family/service addMyUnregisteredFamilyMember", () => {
  describe("正常系", () => {
    it("未登録メンバーを追加して追加結果を返す", async () => {
      vi.mocked(createUnregisteredMemberRow).mockResolvedValue({ id: 8, name: "太郎" });

      await expect(
        addMyUnregisteredFamilyMember({ name: "太郎" }, affiliatedUser),
      ).resolves.toEqual({ id: 8, name: "太郎" });
      expect(createUnregisteredMemberRow).toHaveBeenCalledWith({ familyId: 99, name: "太郎" });
    });
  });

  describe("同じ名前が既にあるとき", () => {
    it("AppError(CONFLICT) を投げる", async () => {
      vi.mocked(createUnregisteredMemberRow).mockResolvedValue(null);

      await expect(
        addMyUnregisteredFamilyMember({ name: "太郎" }, affiliatedUser),
      ).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });
});

describe("family/service removeMyUnregisteredFamilyMember", () => {
  describe("対象が既に削除されているとき", () => {
    it("AppError(NOT_FOUND) を投げる", async () => {
      vi.mocked(deleteUnregisteredMemberRow).mockResolvedValue(false);

      await expect(removeMyUnregisteredFamilyMember(8, affiliatedUser)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });
});

describe("family/service renewMyFamilyInviteCode", () => {
  describe("正常系", () => {
    it("新しい招待コードと有効期限を保存して返す", async () => {
      vi.mocked(findFamilyById).mockResolvedValue({
        id: 99,
        name: "山田家",
        invite_code: "OLD_CODE",
        invite_code_expires_at: "2026-09-01T00:00:00.000Z",
        created_by_user_id: 2,
        created_at: "2026-08-30T00:00:00.000Z",
      });
      vi.mocked(findFamilyByInviteCode).mockResolvedValue(null);

      const result = await renewMyFamilyInviteCode(affiliatedUser);

      expect(result.inviteCode).toHaveLength(8);
      expect(updateInviteCode).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: 99, inviteCode: result.inviteCode }),
      );
    });
  });
});

describe("family/service deleteMyFamily", () => {
  describe("作成者以外が削除するとき", () => {
    it("AppError(FORBIDDEN) を投げ、削除は行わない", async () => {
      vi.mocked(findFamilyById).mockResolvedValue({
        id: 99,
        name: "山田家",
        invite_code: "A3F9K2QP",
        invite_code_expires_at: "2026-09-08T00:00:00.000Z",
        created_by_user_id: 1,
        created_at: "2026-08-30T00:00:00.000Z",
      });

      await expect(deleteMyFamily(affiliatedUser)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(deleteFamilyRow).not.toHaveBeenCalled();
    });
  });
});

describe("family/service leaveMyFamily", () => {
  describe("自分が最後のメンバーのとき", () => {
    it("家族グループ全体を削除する", async () => {
      vi.mocked(findFamilyById).mockResolvedValue({
        id: 99,
        name: "山田家",
        invite_code: "A3F9K2QP",
        invite_code_expires_at: "2026-09-08T00:00:00.000Z",
        created_by_user_id: 2,
        created_at: "2026-08-30T00:00:00.000Z",
      });
      vi.mocked(findOldestFamilyMemberExcept).mockResolvedValue(null);

      await leaveMyFamily(affiliatedUser);

      expect(deleteFamilyRow).toHaveBeenCalledWith(99);
      expect(leaveFamilyRow).not.toHaveBeenCalled();
    });
  });

  describe("作成者が他のメンバーを残して退出するとき", () => {
    it("自分を退出させ、最も早い残存メンバーへ作成者を引き継ぐ", async () => {
      vi.mocked(findFamilyById).mockResolvedValue({
        id: 99,
        name: "山田家",
        invite_code: "A3F9K2QP",
        invite_code_expires_at: "2026-09-08T00:00:00.000Z",
        created_by_user_id: 2,
        created_at: "2026-08-30T00:00:00.000Z",
      });
      vi.mocked(findOldestFamilyMemberExcept).mockResolvedValue({ id: 3 });

      await leaveMyFamily(affiliatedUser);

      expect(leaveFamilyRow).toHaveBeenCalledWith(99, 2);
      expect(updateFamilyCreator).toHaveBeenCalledWith(99, 3);
    });
  });

  describe("作成者ではないメンバーが他のメンバーを残して退出するとき", () => {
    it("自分を退出させ、作成者の引き継ぎは行わない", async () => {
      vi.mocked(findFamilyById).mockResolvedValue({
        id: 99,
        name: "山田家",
        invite_code: "A3F9K2QP",
        invite_code_expires_at: "2026-09-08T00:00:00.000Z",
        created_by_user_id: 1,
        created_at: "2026-08-30T00:00:00.000Z",
      });
      vi.mocked(findOldestFamilyMemberExcept).mockResolvedValue({ id: 3 });

      await leaveMyFamily(affiliatedUser);

      expect(leaveFamilyRow).toHaveBeenCalledWith(99, 2);
      expect(updateFamilyCreator).not.toHaveBeenCalled();
    });
  });
});
