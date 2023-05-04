import { Repository } from 'typeorm';
import { User, Discussion } from '@eten-lab/models';
import { DbService } from '../../services/db.service';

export class DiscussionRepository {
  repository: Repository<Discussion>;
  userRepository: Repository<User>;

  constructor(private readonly dbService: DbService) {
    this.repository = this.dbService.dataSource.getRepository(Discussion);
    this.userRepository = this.dbService.dataSource.getRepository(User);
  }

  async create(
    discussionParams: Omit<Discussion, 'id' | 'user'> & { userId: number },
  ) {
    const discussion = this.repository.create(discussionParams);
    await this.repository.save({
      ...discussion,
      user: { id: discussionParams.userId },
    });
    const user = await this.userRepository.findOne({
      where: { id: discussionParams.userId },
    });
    if (user) {
      // if(user.discussions){
      //     user.discussions.push(discussion)
      // }else {
      //     user.discussions = [discussion]
      // }
      await this.userRepository.save(user);
    }
  }

  getAll() {
    return this.repository.find({ relations: ['user'] });
  }

  _deleteALl() {
    //return this.repository.delete({title: '', text: ''})
  }
}
