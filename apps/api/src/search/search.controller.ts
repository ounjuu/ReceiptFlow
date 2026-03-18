import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { SearchService } from "./search.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query("tenantId") tenantId: string,
    @Query("q") q: string,
    @Query("limit") limit?: string,
  ) {
    if (!q || q.trim().length === 0) {
      return { results: [], totalCount: 0 };
    }
    return this.searchService.search(tenantId, q.trim(), limit ? parseInt(limit, 10) : 5);
  }
}
