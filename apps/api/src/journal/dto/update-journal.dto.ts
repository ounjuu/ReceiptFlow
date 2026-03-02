import { JournalLineDto } from "./create-journal.dto";

export class UpdateJournalDto {
  date?: string;
  description?: string;
  status?: string;
  lines?: JournalLineDto[];
}
