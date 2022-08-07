import {
  Message,
  EmbedBuilder,
  ButtonBuilder,
  CollectorFilter,
  User,
  MessageReaction,
  ColorResolvable,
  ActionRowBuilder,
  SelectMenuBuilder,
  ComponentType,
  SelectMenuInteraction,
  ButtonStyle,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalActionRowComponentBuilder,
  Client,
  Events,
  InteractionType,
  Interaction,
} from 'discord.js';
import {
  GoogleSpreadsheet,
  GoogleSpreadsheetRow,
  GoogleSpreadsheetWorksheet,
} from 'google-spreadsheet';
import randomColor from 'randomcolor';
import { randomIntBetween, sortAlphabet } from '../utility';

const yelp = require('yelp-fusion');

const collectorTime = 1000 * 60 * 15;
// const collectorTime = 1000 * 10;

enum PlacesWorksheetHeader {
  Y_ID = 'Y_ID',
  Date_Added = 'Date Added',
  Last_Updated = 'Last Updated',
  // Visited = 'Visited',
  Favorite = 'Favorite',
  Bucketlist = 'Bucketlist',
  Types = 'Types',
  State = 'State',
  City = 'City',
  Name = 'Name',
  Price = 'Price',
  Categories = 'Categories',
  Tags = 'Tags',
  Top_Orders = 'Top Orders',
  Comments = 'Comments',
  Address = 'Address',
  E_Rating = 'E_Rating',
  N_Rating = 'N_Rating',
  Y_Rating = 'Y_Rating',
  Y_Reviews = 'Y_Reviews',
  ZIP_Code = 'ZIP Code',
  Y_Alias = 'Y_Alias',
  Y_URL = 'Y_URL',
  Longitude = 'Longitude',
  Latitude = 'Latitude',
}

// Commented out are autofilled in Google Sheets
enum PlacesVisitsWorksheetHeader {
  Y_ID = 'Y_ID',
  Date_Visited = 'Date Visited',
  // State = 'State',
  // City = 'City',
  // Name = 'Name',
  Order = 'Order',
  Visitors = 'Visitors',
  Y_URL = 'Y_URL',
}

enum PlacesSymbol {
  Favorite = '⭐',
  Bucketlist = '🪣',
  Toggle_Images = '📷',
  CategoryBullet = '- ',
  TypesBullet = '- ',
  TagsBullet = '- ',
  CommentsBullet = '• ',
  TopOrdersBullet = '• ',
  EVisit = '🥖',
  NVisit = '🐄',
}

interface PlacesTypeAndTagImpl {
  name: string;
  description?: string;
}

const PlacesTypes: PlacesTypeAndTagImpl[] = [
  { name: 'Food', description: 'Places that sell food' },
  { name: 'Bakery' },
  { name: 'Café' },
  { name: 'Boba' },
  { name: 'Dessert' },
  { name: 'Bar' },
  { name: 'Entertainment / Activity' },
  { name: 'Store / Market' },
  { name: "Farmer's Market" },
  { name: 'Museum / Exhibit' },
  { name: 'Landmark' },
];

const PlacesTags: PlacesTypeAndTagImpl[] = [
  { name: 'Interested in going', description: '👀' },
  { name: 'Happy Hour', description: '🍻' },
  { name: 'Instagrammable', description: 'a e s t h e t i c' },
  { name: 'Gimmicks', description: '🤡' },
  { name: 'Date spot', description: '🍷' },
  // { name: 'THANKS KATERHINE', description: '' },
  // { name: 'THANKS ALICE', description: '' },
  {
    name: 'Delicious',
    description: 'yummy yummy yummy in my tummy tummy tummy',
  },
  { name: 'Affordable', description: 'Priced well' },
  { name: 'Expensive', description: '💸' },
  { name: 'Worth it', description: 'Worth the price' },
  // { name: 'TooGoodToGo', description: '' },
];

enum PlacesFormCustomId {
  TypesSelectBox = 'typesSelectBox',
  TagsSelectBox = 'tagsSelectBox',
  ERateButton = 'eRateButton',
  NRateButton = 'nRateButton',
  AddTopOrderOrCommentButton = 'topOrderOrCommentButton',
  AddVisitButton = 'addVisitButton',
  // Modals
  // Modal custom-ids are appended with a random number because of how they are processed
  ERateModal = 'eRateModal',
  ERateTextInput = 'eRateTextInput',
  NRateModal = 'nRateModal',
  NRateTextInput = 'nRateTextInput',
  AddTopOrderOrCommentModal = 'addTopOrderOrCommentModal',
  AddTopOrderTextInput = 'addTopOrderTextInput',
  AddCommentTextInput = 'addCommentTextInput',
  AddVisitModal = 'addVisitModal',
  AddVisitDateTextInput = 'addVisitDateTextInput',
  AddVisitOrderTextInput = 'addVisitOrderTextInput',
}

export class PlacesManager {
  client!: Client;

  // Google Sheets
  googleSpreadsheetId: string;
  googleSpreadsheetEmail: string;
  googleSpreadsheetPrivateKey: string;

  googleSpreadsheet!: GoogleSpreadsheet;
  placesWorksheet!: GoogleSpreadsheetWorksheet;
  visitsWorksheet!: GoogleSpreadsheetWorksheet;

  // Yelp
  yelpApiKey: string;
  yelpClient: any;

  // Cached Rows
  placesCache!: {
    places: GoogleSpreadsheetRow[];
    categories: string[];
    types: string[];
    tags: string[];
    states: string[];
    cities: string[];
  };

  constructor(
    googleSpreadsheetId: string,
    googleSpreadsheetEmail: string,
    googleSpreadsheetPrivateKey: string,
    yelpApiKey: string,
  ) {
    this.googleSpreadsheetId = googleSpreadsheetId;
    this.googleSpreadsheetEmail = googleSpreadsheetEmail;
    this.googleSpreadsheetPrivateKey = googleSpreadsheetPrivateKey;
    this.yelpApiKey = yelpApiKey;
  }

  public injectClient = (client: Client) => {
    this.client = client;
  };

  public connect = async () => {
    this.yelpClient = yelp.client(this.yelpApiKey);

    this.googleSpreadsheet = new GoogleSpreadsheet(this.googleSpreadsheetId);
    await this.googleSpreadsheet.useServiceAccountAuth({
      client_email: this.googleSpreadsheetEmail,
      private_key: this.googleSpreadsheetPrivateKey,
    });
    await this.googleSpreadsheet.loadInfo();

    this.placesWorksheet = this.googleSpreadsheet.sheetsByIndex[0];
    this.visitsWorksheet = this.googleSpreadsheet.sheetsByIndex[1];
  };

  updatePlacesCache = async () => {
    const placesRows = await this.placesWorksheet.getRows();

    this.placesCache = {
      places: placesRows,
      categories: [
        ...new Set(
          ...placesRows.map((place) =>
            place[PlacesWorksheetHeader.Categories]
              .split('\n')
              .map((category: string) =>
                category.substring(PlacesSymbol.CategoryBullet.length),
              ),
          ),
        ),
      ] as string[],
      tags: [
        ...new Set(
          ...placesRows.map((place) =>
            place[PlacesWorksheetHeader.Tags]
              ? place[PlacesWorksheetHeader.Tags]
                  .split('\n')
                  .map((tag: string) =>
                    tag.substring(PlacesSymbol.TagsBullet.length),
                  )
              : null,
          ),
        ),
      ] as string[],
      types: [
        ...new Set(
          ...placesRows.map((place) =>
            place[PlacesWorksheetHeader.Types]
              ? place[PlacesWorksheetHeader.Types]
                  .split('\n')
                  .map((type: string) =>
                    type.substring(PlacesSymbol.TypesBullet.length),
                  )
              : null,
          ),
        ),
      ] as string[],
      states: [
        ...new Set(
          placesRows.map((place) => place[PlacesWorksheetHeader.State]),
        ),
      ],
      cities: [
        ...new Set(
          placesRows.map((place) => place[PlacesWorksheetHeader.City]),
        ),
      ],
    };
  };

  public pickRandomPlace = async () => {};

  public processPlace = async (
    message: Message,
    businessId: string,
    isBucketlist: boolean,
  ) => {
    const yelpBusinessJson = (await this.yelpClient.business(businessId))
      .jsonBody;
    const place = new Place(
      yelpBusinessJson,
      this.client,
      this.visitsWorksheet,
    );

    const rows = await this.placesWorksheet.getRows();
    let placeRow = rows.find(
      (row) => row[PlacesWorksheetHeader.Y_ID] === place.yelpInfo.id,
    );

    if (placeRow) {
      // If row found, update row
      placeRow[PlacesWorksheetHeader.Last_Updated] =
        new Date().toLocaleDateString();
      placeRow[PlacesWorksheetHeader.Price] = place.yelpInfo.price;
      placeRow[PlacesWorksheetHeader.Y_Rating] = place.yelpInfo.rating;
      placeRow[PlacesWorksheetHeader.Y_Reviews] = place.yelpInfo.reviewCount;

      placeRow.save();
    } else {
      // Else, create new row
      placeRow = await this.placesWorksheet.addRow(
        place.getNewRow(isBucketlist),
      );
    }

    place.setPlaceRow(placeRow);

    place.createEmbeds();
    place.createFormElements();

    await place.respondToTriggerMessage(message);
  };
}

interface yelpInfoImpl {
  id: string;
  alias: string;
  name: string;
  imageUrl?: string;
  url: string;
  phoneNumber: string;
  rating: number;
  reviewCount: number;
  price: string;
  photos: string[];
  categories: { alias: string; title: string }[];
  coordinates: { latitude: number; longitude: number };
  address: string;
  state: string;
  city: string;
  zipCode: string;
}

interface userInfoImpl {
  favorite: string;
  bucketlist: string;
  eRating: string;
  nRating: string;
  types: string[];
  tags: string[];
  topOrders: string;
  comments: string;
}

class Place {
  client: Client;
  visitsWorksheet: GoogleSpreadsheetWorksheet;

  currentRandomIndex: number;

  yelpInfo: yelpInfoImpl;
  userInfo!: userInfoImpl;

  embedColor: ColorResolvable = randomColor({
    luminosity: 'bright',
    format: 'rgbArray',
  }) as ColorResolvable;
  yelpEmbed!: EmbedBuilder;
  userEmbed!: EmbedBuilder;
  mainMessage!: Message;

  placeRow!: GoogleSpreadsheetRow;
  currentPhotoIndex = 0;

  typesActionRow!: ActionRowBuilder<SelectMenuBuilder>;
  tagsActionRow!: ActionRowBuilder<SelectMenuBuilder>;
  buttonRow!: ActionRowBuilder<ButtonBuilder>;

  // Modals
  eRatingModal!: ModalBuilder;
  nRatingModal!: ModalBuilder;
  addTopOrderOrCommentModal!: ModalBuilder;
  addVisitModal!: ModalBuilder;
  modalEventHandler!: (interaction: Interaction) => Promise<void>;

  // Visits
  // visits: Visit[] = [];

  constructor(
    yelpBusinessJson: any,
    client: Client,
    visitsWorksheet: GoogleSpreadsheetWorksheet,
  ) {
    this.client = client;
    this.visitsWorksheet = visitsWorksheet;
    this.currentRandomIndex = Math.random();

    this.yelpInfo = {
      id: yelpBusinessJson.id,
      alias: yelpBusinessJson.alias,
      name: yelpBusinessJson.name,
      imageUrl: yelpBusinessJson.image_url,
      url: yelpBusinessJson.url.split('?')[0],
      phoneNumber: yelpBusinessJson.display_phone || '(none)',
      rating: yelpBusinessJson.rating,
      reviewCount: yelpBusinessJson.review_count,
      price: yelpBusinessJson.price || '(none)',
      photos: yelpBusinessJson.photos || [],
      categories: yelpBusinessJson.categories,
      coordinates: yelpBusinessJson.coordinates,
      // Address related
      address: yelpBusinessJson.location.display_address.join('\n'),
      state: yelpBusinessJson.location.state,
      city: yelpBusinessJson.location.city,
      zipCode: yelpBusinessJson.location.zip_code,
    };
  }

  createEmbeds = () => {
    this.yelpEmbed = new EmbedBuilder()
      .setColor(this.embedColor)
      // .setColor(Colors.Yellow)
      .setTitle(this.yelpInfo.name)
      .setURL(this.yelpInfo.url)
      .setDescription(
        this.yelpInfo.categories.map((category) => category.title).join(', '),
      )
      .addFields(
        { name: 'Address', value: this.yelpInfo.address },
        { name: 'Price', value: this.yelpInfo.price, inline: true },
        {
          name: 'Phone Number',
          value: this.yelpInfo.phoneNumber,
          inline: true,
        },
        {
          name: 'Rating',
          value: `${'🌕'.repeat(Math.floor(this.yelpInfo.rating))}${
            this.yelpInfo.rating % 1 !== 0 ? '🌗' : ''
          }${'🌑'.repeat(5 - Math.ceil(this.yelpInfo.rating))} (${
            this.yelpInfo.reviewCount
          } reviews)`,
        },
      );

    if (this.yelpInfo.imageUrl) {
      this.yelpEmbed.setThumbnail(this.yelpInfo.imageUrl);
    }
    if (this.yelpInfo.photos.length) {
      this.yelpEmbed.setImage(this.yelpInfo.photos[this.currentPhotoIndex]);
    }

    this.userEmbed = new EmbedBuilder()
      // .setColor(randomHSL() as ColorResolvable)
      .setColor(this.embedColor)
      .setDescription('User (non-Yelp) information below.')
      .addFields(
        {
          name: 'Favorite',
          value:
            `${this.userInfo.favorite}${this.userInfo.bucketlist}` || '(no)',
          inline: true,
        },
        {
          name: 'E Rating',
          value: this.userInfo.eRating || '(none)',
          inline: true,
        },
        {
          name: 'N Rating',
          value: this.userInfo.nRating || '(none)',
          inline: true,
        },
        {
          name: 'Types',
          value: this.userInfo.types.length
            ? this.userInfo.types.join(', ')
            : '(none)',
        },
        {
          name: 'Tags',
          value: this.userInfo.tags.length
            ? this.userInfo.tags.join(', ')
            : '(none)',
        },
        {
          name: 'Top Orders',
          value: this.userInfo.topOrders ? this.userInfo.topOrders : '(none)',
        },
        {
          name: 'Comments',
          value: this.userInfo.comments ? this.userInfo.comments : '(none)',
        },
      );
  };

  createFormElements = () => {
    // Types Select Box
    this.typesActionRow =
      new ActionRowBuilder<SelectMenuBuilder>().addComponents(
        new SelectMenuBuilder()
          .setCustomId(PlacesFormCustomId.TypesSelectBox)
          .setMinValues(0)
          .setMaxValues(PlacesTypes.length)
          .setPlaceholder('Select location types')
          .addOptions(
            PlacesTypes.map((type) => ({
              label: type.name,
              description: type.description,
              value: type.name,
              default: this.userInfo.types.includes(type.name),
            })),
          ),
      );

    // Tags Select Box
    this.tagsActionRow =
      new ActionRowBuilder<SelectMenuBuilder>().addComponents(
        new SelectMenuBuilder()
          .setCustomId(PlacesFormCustomId.TagsSelectBox)
          .setMinValues(0)
          .setMaxValues(PlacesTags.length)
          .setPlaceholder('Select tags')
          .addOptions(
            PlacesTags.map((tag) => ({
              label: tag.name,
              description: tag.description,
              value: tag.name,
              default: this.userInfo.tags.includes(tag.name),
            })),
          ),
      );

    // Buttons
    this.buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(PlacesFormCustomId.ERateButton)
        .setLabel('Elaine Rate')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(PlacesFormCustomId.NRateButton)
        .setLabel('Neuton Rate')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(PlacesFormCustomId.AddTopOrderOrCommentButton)
        .setLabel('Add Top Orders / Comment')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(PlacesFormCustomId.AddVisitButton)
        .setLabel('Add Visit')
        .setStyle(ButtonStyle.Success),
    );

    // Created in anther function to keep code clean
    this.createModals();
  };

  createModals = () => {
    // Elaine Rate Modal
    this.eRatingModal = new ModalBuilder()
      .setCustomId(
        `${PlacesFormCustomId.ERateModal}-${this.currentRandomIndex}`,
      )
      .setTitle("Elaine's Rating")
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(PlacesFormCustomId.ERateTextInput)
            .setLabel('Enter your rating')
            .setStyle(TextInputStyle.Short),
        ),
      );

    // Neuton Rate Modal
    this.nRatingModal = new ModalBuilder()
      .setCustomId(
        `${PlacesFormCustomId.NRateModal}-${this.currentRandomIndex}`,
      )
      .setTitle("Neuton's Rating")
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(PlacesFormCustomId.NRateTextInput)
            .setLabel('Enter your rating')
            .setStyle(TextInputStyle.Short),
        ),
      );

    // Add Top Order Or Comment Modal
    this.addTopOrderOrCommentModal = new ModalBuilder()
      .setCustomId(
        `${PlacesFormCustomId.AddTopOrderOrCommentModal}-${this.currentRandomIndex}`,
      )
      .setTitle('Add a top order or comment')
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(PlacesFormCustomId.AddTopOrderTextInput)
            .setLabel('Enter a top order')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false),
        ),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(PlacesFormCustomId.AddCommentTextInput)
            .setLabel('Enter a new comment')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false),
        ),
      );

    // Add Visit Modal
    this.addVisitModal = new ModalBuilder()
      .setCustomId(
        `${PlacesFormCustomId.AddVisitModal}-${this.currentRandomIndex}`,
      )
      .setTitle('Add a visit')
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(PlacesFormCustomId.AddVisitOrderTextInput)
            .setLabel('Enter your order')
            .setStyle(TextInputStyle.Paragraph),
        ),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(PlacesFormCustomId.AddVisitDateTextInput)
            .setLabel('Enter a date')
            .setStyle(TextInputStyle.Short)
            .setValue(new Date().toLocaleDateString()),
        ),
      );
  };

  refreshEmbedsAndComponents = (removeComponents: boolean = false) => {
    this.currentRandomIndex = Math.random();

    this.createEmbeds();
    this.createFormElements();

    this.mainMessage.edit({
      embeds: [this.yelpEmbed, this.userEmbed],
      components: removeComponents
        ? []
        : [this.typesActionRow, this.tagsActionRow, this.buttonRow],
    });
  };

  respondToTriggerMessage = async (message: Message) => {
    this.mainMessage = await message.reply({
      embeds: [this.yelpEmbed, this.userEmbed],
      components: [this.typesActionRow, this.tagsActionRow, this.buttonRow],
    });

    this.setupFormCollectors();
  };

  setupFormCollectors = async () => {
    // Reaction Collector
    await this.mainMessage.react(PlacesSymbol.Favorite);
    await this.mainMessage.react(PlacesSymbol.Bucketlist);
    await this.mainMessage.react(PlacesSymbol.Toggle_Images);

    const reactionFilter: CollectorFilter<[MessageReaction, User]> = (
      reaction,
      user,
    ) => {
      return (
        !user.bot &&
        [
          PlacesSymbol.Favorite.toString(),
          PlacesSymbol.Bucketlist.toString(),
          PlacesSymbol.Toggle_Images.toString(),
        ].includes(reaction.emoji.name!)
      );
    };
    const reactionCollector = this.mainMessage.createReactionCollector({
      filter: reactionFilter,
      time: collectorTime,
    });
    reactionCollector.on('collect', (reaction, user) => {
      if (reaction.emoji.name === PlacesSymbol.Favorite) {
        this.userInfo.favorite = this.userInfo.favorite
          ? ''
          : PlacesSymbol.Favorite;

        this.placeRow[PlacesWorksheetHeader.Favorite] = this.userInfo.favorite;
        this.placeRow.save();
        this.refreshEmbedsAndComponents();
      } else if (reaction.emoji.name === PlacesSymbol.Bucketlist) {
        this.userInfo.bucketlist = this.userInfo.bucketlist
          ? ''
          : PlacesSymbol.Bucketlist;
        this.placeRow[PlacesWorksheetHeader.Bucketlist] =
          this.userInfo.bucketlist;
        this.placeRow.save();
        this.refreshEmbedsAndComponents();
      } else if (reaction.emoji.name === PlacesSymbol.Toggle_Images) {
        this.currentPhotoIndex++;
        this.currentPhotoIndex %= this.yelpInfo.photos.length;

        this.refreshEmbedsAndComponents();
      }

      this.mainMessage.reactions
        .resolve(reaction.emoji.name!)
        ?.users.remove(user.id);
    });
    reactionCollector.on('end', (_collected) => {
      this.mainMessage.reactions.removeAll();
    });

    // Select Box Collector
    const typesAndTagsSelectBoxCollector =
      this.mainMessage.createMessageComponentCollector({
        componentType: ComponentType.SelectMenu,
        time: collectorTime,
      });

    typesAndTagsSelectBoxCollector.on(
      'collect',
      (interaction: SelectMenuInteraction) => {
        const selectBoxCustomId = interaction.customId;
        const selectBoxValues = interaction.values;

        if (selectBoxCustomId === PlacesFormCustomId.TypesSelectBox) {
          this.userInfo.types = selectBoxValues;
          this.placeRow[PlacesWorksheetHeader.Types] = this.userInfo.types
            .sort()
            .map((type) => `${PlacesSymbol.TypesBullet}${type}`)
            .join('\n');
        } else if (selectBoxCustomId === PlacesFormCustomId.TagsSelectBox) {
          this.userInfo.tags = selectBoxValues;
          this.placeRow[PlacesWorksheetHeader.Tags] = this.userInfo.tags
            .sort()
            .map((tag) => `${PlacesSymbol.TagsBullet}${tag}`)
            .join('\n');
        }

        this.placeRow.save();
        this.refreshEmbedsAndComponents();
        interaction.deferUpdate();
      },
    );

    typesAndTagsSelectBoxCollector.on(
      'end',
      (_interaction: SelectMenuInteraction) => {
        // Have to remove the modal listener
        this.client.removeListener(
          Events.InteractionCreate,
          this.modalEventHandler,
        );

        this.refreshEmbedsAndComponents(true);
      },
    );

    // Button Collectors
    const buttonsCollector = this.mainMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: collectorTime,
    });

    buttonsCollector.on('collect', (interaction: ButtonInteraction) => {
      const buttonCustomId = interaction.customId;

      if (buttonCustomId === PlacesFormCustomId.ERateButton) {
        interaction.showModal(this.eRatingModal);
      } else if (buttonCustomId === PlacesFormCustomId.NRateButton) {
        interaction.showModal(this.nRatingModal);
      } else if (
        buttonCustomId === PlacesFormCustomId.AddTopOrderOrCommentButton
      ) {
        interaction.showModal(this.addTopOrderOrCommentModal);
      } else if (buttonCustomId === PlacesFormCustomId.AddVisitButton) {
        interaction.showModal(this.addVisitModal);
      }
    });

    // Modal Submission Collectors
    // TODO: For some reason, cannot deferUpdate on Modal Submits
    // Store in a variable so it can be unset
    this.modalEventHandler = async (interaction: Interaction) => {
      if (interaction.type !== InteractionType.ModalSubmit) return;

      if (
        interaction.customId ===
        `${PlacesFormCustomId.ERateModal}-${this.currentRandomIndex}`
      ) {
        this.userInfo.eRating = interaction.fields.getTextInputValue(
          PlacesFormCustomId.ERateTextInput,
        );
        this.placeRow[PlacesWorksheetHeader.E_Rating] = this.userInfo.eRating;
        this.placeRow.save();
        this.refreshEmbedsAndComponents();

        // Cast as ButtonInteraction to run deferUpdate()
        (interaction as unknown as ButtonInteraction).deferUpdate();
      } else if (
        interaction.customId ===
        `${PlacesFormCustomId.NRateModal}-${this.currentRandomIndex}`
      ) {
        this.userInfo.nRating = interaction.fields.getTextInputValue(
          PlacesFormCustomId.NRateTextInput,
        );
        this.placeRow[PlacesWorksheetHeader.N_Rating] = this.userInfo.nRating;
        this.placeRow.save();
        this.refreshEmbedsAndComponents();

        // Cast as ButtonInteraction to run deferUpdate()
        (interaction as unknown as ButtonInteraction).deferUpdate();
      } else if (
        interaction.customId ===
        `${PlacesFormCustomId.AddTopOrderOrCommentModal}-${this.currentRandomIndex}`
      ) {
        const newTopOrder = interaction.fields
          .getTextInputValue(PlacesFormCustomId.AddTopOrderTextInput)
          .trim();

        const newComment = interaction.fields
          .getTextInputValue(PlacesFormCustomId.AddCommentTextInput)
          .trim();

        let hasNewTopOrderOrComment = false;

        if (newTopOrder) {
          this.userInfo.topOrders += `${this.userInfo.topOrders ? '\n' : ''}${
            PlacesSymbol.TopOrdersBullet
          }${newTopOrder}`;
          this.placeRow[PlacesWorksheetHeader.Top_Orders] =
            this.userInfo.topOrders;
          hasNewTopOrderOrComment = true;
        }

        if (newComment) {
          this.userInfo.comments += `${this.userInfo.comments ? '\n' : ''}${
            PlacesSymbol.CommentsBullet
          }${newComment}`;
          this.placeRow[PlacesWorksheetHeader.Comments] =
            this.userInfo.comments;
          hasNewTopOrderOrComment = true;
        }

        if (hasNewTopOrderOrComment) {
          this.placeRow.save();
          this.refreshEmbedsAndComponents();
        }

        // Cast as ButtonInteraction to run deferUpdate()
        (interaction as unknown as ButtonInteraction).deferUpdate();
      } else if (
        interaction.customId ===
        `${PlacesFormCustomId.AddVisitModal}-${this.currentRandomIndex}`
      ) {
        const newVisitDate = interaction.fields.getTextInputValue(
          PlacesFormCustomId.AddVisitDateTextInput,
        );
        const newVisitOrder = interaction.fields
          .getTextInputValue(PlacesFormCustomId.AddVisitOrderTextInput)
          .trim();

        const visitRow = await this.visitsWorksheet.addRow({
          [PlacesVisitsWorksheetHeader.Y_ID]: this.yelpInfo.id,
          [PlacesVisitsWorksheetHeader.Date_Visited]: newVisitDate,
          [PlacesVisitsWorksheetHeader.Order]: newVisitOrder,
        });

        const visit = new Visit(this, newVisitDate, newVisitOrder, visitRow);
        await visit.createVisit();

        // Cast as ButtonInteraction to run deferUpdate()
        (interaction as unknown as ButtonInteraction).deferUpdate();
      }
    };

    this.client.on(Events.InteractionCreate, this.modalEventHandler);
  };

  getNewRow = (isBucketlist: boolean) => ({
    [PlacesWorksheetHeader.Y_ID]: this.yelpInfo.id,
    [PlacesWorksheetHeader.Date_Added]: new Date().toLocaleDateString(),
    [PlacesWorksheetHeader.Bucketlist]: isBucketlist
      ? PlacesSymbol.Bucketlist
      : '',
    [PlacesWorksheetHeader.State]: this.yelpInfo.state,
    [PlacesWorksheetHeader.City]: this.yelpInfo.city,
    [PlacesWorksheetHeader.Name]: this.yelpInfo.name,
    [PlacesWorksheetHeader.Price]: this.yelpInfo.price,
    [PlacesWorksheetHeader.Categories]: this.yelpInfo.categories
      .map((category) => `${PlacesSymbol.CategoryBullet}${category.title}`)
      .join('\n'),
    [PlacesWorksheetHeader.Address]: this.yelpInfo.address,
    [PlacesWorksheetHeader.Y_Rating]: this.yelpInfo.rating,
    [PlacesWorksheetHeader.Y_Reviews]: this.yelpInfo.reviewCount,
    [PlacesWorksheetHeader.ZIP_Code]: this.yelpInfo.zipCode,
    [PlacesWorksheetHeader.Y_Alias]: this.yelpInfo.alias,
    [PlacesWorksheetHeader.Y_URL]: this.yelpInfo.url,
    [PlacesWorksheetHeader.Longitude]: this.yelpInfo.coordinates.longitude,
    [PlacesWorksheetHeader.Latitude]: this.yelpInfo.coordinates.latitude,
    [PlacesWorksheetHeader.Latitude]: this.yelpInfo.coordinates.latitude,
  });

  setPlaceRow = (placeRow: GoogleSpreadsheetRow) => {
    this.placeRow = placeRow;

    this.userInfo = {
      favorite: this.placeRow[PlacesWorksheetHeader.Favorite],
      bucketlist: this.placeRow[PlacesWorksheetHeader.Bucketlist],
      eRating: this.placeRow[PlacesWorksheetHeader.E_Rating],
      nRating: this.placeRow[PlacesWorksheetHeader.N_Rating],
      types: this.placeRow[PlacesWorksheetHeader.Types]
        ? this.placeRow[PlacesWorksheetHeader.Types]
            .split('\n')
            .map((type: string) =>
              type.substring(PlacesSymbol.TypesBullet.length),
            )
        : [],
      tags: this.placeRow[PlacesWorksheetHeader.Tags]
        ? this.placeRow[PlacesWorksheetHeader.Tags]
            .split('\n')
            .map((tag: string) => tag.substring(PlacesSymbol.TagsBullet.length))
        : [],
      topOrders: this.placeRow[PlacesWorksheetHeader.Top_Orders],
      comments: this.placeRow[PlacesWorksheetHeader.Comments],
    };
  };
}

class Visit {
  place: Place;
  newVisitDate: string;
  newVisitOrder: string;
  visitRow: GoogleSpreadsheetRow;

  visitEmbed!: EmbedBuilder;
  visitMessage!: Message;

  constructor(
    place: Place,
    newVisitDate: string,
    newVisitOrder: string,
    visitRow: GoogleSpreadsheetRow,
  ) {
    this.place = place;
    this.newVisitDate = newVisitDate;
    this.newVisitOrder = newVisitOrder;
    this.visitRow = visitRow;
  }

  createVisit = async () => {
    await this.createEmbed();
    this.visitMessage = await this.place.mainMessage.reply({
      embeds: [this.visitEmbed],
    });
    await this.setupFormCollector();
  };

  createEmbed = async () => {
    this.visitEmbed = new EmbedBuilder()
      .setColor(this.place.embedColor)
      .setTitle(`${this.newVisitDate} - ${this.place.yelpInfo.name}`)
      .setURL(this.place.yelpInfo.url)
      .addFields(
        {
          name: 'Visitors',
          value: this.visitRow[PlacesVisitsWorksheetHeader.Visitors]
            ? this.visitRow[PlacesVisitsWorksheetHeader.Visitors]
            : '(no one)',
        },

        {
          name: 'Order',
          value: this.visitRow[PlacesVisitsWorksheetHeader.Order],
        },
      );
    // .setFooter({ text: `Visited on ` });
  };

  refreshEmbed = async () => {
    this.createEmbed();
    this.visitMessage.edit({
      embeds: [this.visitEmbed],
    });
  };

  setupFormCollector = async () => {
    await this.visitMessage.react(PlacesSymbol.EVisit);
    await this.visitMessage.react(PlacesSymbol.NVisit);

    const reactionFilter: CollectorFilter<[MessageReaction, User]> = (
      reaction,
      user,
    ) => {
      return (
        !user.bot &&
        [
          PlacesSymbol.EVisit.toString(),
          PlacesSymbol.NVisit.toString(),
        ].includes(reaction.emoji.name!)
      );
    };
    const reactionCollector = this.visitMessage.createReactionCollector({
      filter: reactionFilter,
      time: collectorTime,
    });
    reactionCollector.on('collect', (reaction, user) => {
      if (!this.visitRow[PlacesVisitsWorksheetHeader.Visitors]) {
        this.visitRow[PlacesVisitsWorksheetHeader.Visitors] =
          reaction.emoji.name;
      } else {
        if (
          this.visitRow[PlacesVisitsWorksheetHeader.Visitors].includes(
            reaction.emoji.name,
          )
        ) {
          this.visitRow[PlacesVisitsWorksheetHeader.Visitors] = this.visitRow[
            PlacesVisitsWorksheetHeader.Visitors
          ].replace(reaction.emoji.name, '');
        } else {
          this.visitRow[PlacesVisitsWorksheetHeader.Visitors] +=
            reaction.emoji.name;
          this.visitRow[PlacesVisitsWorksheetHeader.Visitors] = sortAlphabet(
            this.visitRow[PlacesVisitsWorksheetHeader.Visitors],
          );
        }
      }

      this.visitRow.save();
      this.refreshEmbed();

      this.visitMessage.reactions
        .resolve(reaction.emoji.name!)
        ?.users.remove(user.id);
    });
    reactionCollector.on('end', (_collected) => {
      this.visitMessage.reactions.removeAll();
    });

    this.visitMessage.createReactionCollector({
      filter: reactionFilter,
      time: collectorTime,
    });
  };
}
